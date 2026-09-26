import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Logger,
    Req,
    BadRequestException,
    UnauthorizedException,
} from '@nestjs/common';
import { ProxyServerService } from '../proxy-server/proxy-server.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../logger/logger.service';
import { ProxyStatus, ProxyType } from '@prisma/client';
import { isDevEnv } from '../shared/utils/is-dev';
import { NodeService } from '../node/node.service';

// These are the only database columns used by traffic accounting. Keep this
// allowlist next to the raw SQL below so the dynamic identifier can never come
// from a request body.
const TRAFFIC_DB_COLUMN_BY_FIELD: Record<string, string> = {
    residentTrafficLeft: 'resident_traffic_left',
    premiumTrafficLeft: 'premium_trafic_left',
    mobileGbTrafficLeft: 'mobile_gb_traffic_left',
    ipv6GbTrafficLeft: 'ipv6_gb_traffic_left',
    ispUsaTrafficLeft: 'isp_usa_traffic_left',
    ispEuTrafficLeft: 'isp_eu_traffic_left',
    residentialLiteTrafficLeft: 'residential_lite_traffic_left',
};

@Controller('proxy-node')
export class ProxyNodeController {
    private readonly logger = new Logger(ProxyNodeController.name);

    constructor(
        private proxyServerService: ProxyServerService,
        private prisma: PrismaService,
        private loggerService: LoggerService,
        private nodeService: NodeService,
    ) {}

    // Регистрация прокси-ноды (для агентов, без авторизации)
    // IP сервера: body.ip или body.server_id (для дебага) → иначе x-forwarded-for / req.ip
    @Post('/register')
    @HttpCode(HttpStatus.OK)
    async registerProxyNode(@Body() body: { server_id?: string; ip?: string }, @Req() req: any) {
        // IP, с которого пришёл запрос (для логов и ответа)
        const requestIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
        // IP сервера для поиска в БД: кастомный из body (дебаг) или из запроса
        const serverIp = body.ip ?? body.server_id ?? requestIp;

        this.logger.log(`[REGISTER] Запрос от IP: ${requestIp}, сервер для регистрации: ${serverIp}`);
        this.logger.log(`[REGISTER] Body: ${JSON.stringify(body)}`);

        if (!serverIp) {
            throw new BadRequestException('Не удалось определить IP адрес сервера (передайте ip или server_id в body, или запрос должен содержать X-Forwarded-For / req.ip)');
        }

        try {
            const result = await this.proxyServerService.registerProxyNode(serverIp);
            this.logger.log(`[REGISTER] Успешная регистрация сервера: ${serverIp}`);
            return {
                ...result,
                request_ip: requestIp,
            };
        } catch (error) {
            this.logger.error(`[REGISTER] Ошибка регистрации: ${error.message}`);
            throw error;
        }
    }

    // Получение трафика от прокси-ноды
    // Этот endpoint также служит индикатором здоровья сервера:
    // если трафик приходит - сервер жив, если не приходит долго - сервер может быть OFFLINE
    @Post('/traffic')
    @HttpCode(HttpStatus.OK)
    async receiveTraffic(@Body() body: any, @Req() req: any) {
        const serverId = typeof body.server_id === 'string' ? body.server_id.trim() : '';
        const reportingServer = serverId
            ? await this.prisma.proxyServer.findFirst({
                where: { host: serverId },
                select: { host: true, token: true },
            })
            : null;

        // Новые агенты передают реальный server_id. Для них проверяем тот же токен,
        // которым защищён control-plane, и привязываем login к конкретному gateway.
        // Legacy server_id пока принимается для плавного обновления старых нод.
        if (reportingServer) {
            const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
            if (!reportingServer.token || bearer !== reportingServer.token) {
                throw new UnauthorizedException('Неверный токен прокси-сервера');
            }
        }

        if (isDevEnv) {
            const n = body.logs?.length ?? 0;
            this.logger.debug(
                `[TRAFFIC] ip=${req.ip ?? "?"} server=${body.server_id ?? "?"} logs=${n} in=${body.total_in ?? 0} out=${body.total_out ?? 0}`,
            );
        }
        
        // Обрабатываем трафик и списываем его с балансов пользователей
        if (body.logs && Array.isArray(body.logs) && body.logs.length > 0) {
            const now = new Date();
            // V2: группируем по login (user), т.к. порт 10000 общий
            const trafficByLogin = new Map<string, { inBytes: bigint; outBytes: bigint }>();
            
            for (const log of body.logs) {
                const login = log.user || log.login;
                if (!login || typeof login !== 'string') continue;
                
                const inBytes = BigInt(log.in_bytes || 0);
                const outBytes = BigInt(log.out_bytes || 0);
                const totalBytes = inBytes + outBytes;
                
                if (totalBytes > 0n) {
                    const existing = trafficByLogin.get(login);
                    if (existing) {
                        existing.inBytes += inBytes;
                        existing.outBytes += outBytes;
                    } else {
                        trafficByLogin.set(login, { inBytes, outBytes });
                    }
                }
            }
            
            const proxiesToSuspend: Array<{ id: string; serverHost: string | null; userLogin: string | null; type: ProxyType }> = [];
            const trafficByPackage = new Map<string, { inBytes: bigint; outBytes: bigint }>();
            
            for (const [login, traffic] of trafficByLogin.entries()) {
                const totalBytes = traffic.inBytes + traffic.outBytes;
                
                const proxy = await this.prisma.proxy.findFirst({
                    where: {
                        userLogin: login,
                        ...(reportingServer ? { serverHost: reportingServer.host } : {}),
                    },
                    include: {
                        user: true,
                        userPackage: true,
                    },
                });
                
                if (!proxy || !proxy.user) {
                    continue;
                }
                
                // Делает счётчик прокси атомарным: два параллельных отчёта не
                // могут затереть друг другу trafficUsed старым snapshot-ом.
                await this.prisma.$executeRawUnsafe(
                    `UPDATE "proxies"
                     SET "last_activity_at" = $1,
                         "traffic_used" = (CAST("traffic_used" AS NUMERIC) + $2::numeric)::text
                     WHERE "id" = $3`,
                    now,
                    totalBytes.toString(),
                    proxy.id,
                );
                
                // Обновляем updatedAt UserPackage, если он есть
                if (proxy.userPackageId) {
                    // Обновляем updatedAt UserPackage
                    await this.prisma.userPackage.update({
                        where: { id: proxy.userPackageId },
                        data: { updatedAt: new Date() },
                    }).catch(() => {}); // Игнорируем ошибки, если UserPackage уже удален
                    
                    // Группируем трафик по UserPackage
                    const existing = trafficByPackage.get(proxy.userPackageId);
                    if (existing) {
                        existing.inBytes += traffic.inBytes;
                        existing.outBytes += traffic.outBytes;
                    } else {
                        trafficByPackage.set(proxy.userPackageId, {
                            inBytes: traffic.inBytes,
                            outBytes: traffic.outBytes,
                        });
                    }
                }
                
                // Определяем тип трафика для списания
                const proxyType = proxy.type;
                let trafficField: 'residentTrafficLeft' | 'premiumTrafficLeft' | 'mobileGbTrafficLeft' | 'ipv6GbTrafficLeft' | 'ispUsaTrafficLeft' | 'ispEuTrafficLeft' | 'residentialLiteTrafficLeft' | null = null;
                let typeLabel: string = '';

                if (proxyType === ProxyType.RESIDENT) {
                    trafficField = 'residentTrafficLeft';
                    typeLabel = 'RESIDENT';
                } else if (proxyType === ProxyType.RESIDENT_PREMIUM) {
                    trafficField = 'premiumTrafficLeft';
                    typeLabel = 'RESIDENT_PREMIUM';
                } else if (proxyType === ProxyType.MOBILE_GB) {
                    trafficField = 'mobileGbTrafficLeft';
                    typeLabel = 'MOBILE_GB';
                } else if (proxyType === ProxyType.IPV6_GB) {
                    trafficField = 'ipv6GbTrafficLeft';
                    typeLabel = 'IPV6_GB';
                } else if ((proxyType as string) === 'ISP_USA') {
                    trafficField = 'ispUsaTrafficLeft';
                    typeLabel = 'ISP_USA';
                } else if ((proxyType as string) === 'ISP_EU') {
                    trafficField = 'ispEuTrafficLeft';
                    typeLabel = 'ISP_EU';
                } else if ((proxyType as string) === 'RESIDENTIAL_LITE') {
                    trafficField = 'residentialLiteTrafficLeft';
                    typeLabel = 'RESIDENTIAL_LITE';
                }

                // Списываем трафик с баланса пользователя атомарно. Старый код
                // читал proxy.user один раз и затем делал обычный update; при
                // одновременных отчётах это могло преждевременно поставить
                // баланс в 0 и заблокировать все прокси пакета.
                if (trafficField) {
                    const trafficColumn = TRAFFIC_DB_COLUMN_BY_FIELD[trafficField];
                    const balanceRows = await this.prisma.$queryRawUnsafe<Array<{ balance: string }>>(
                        `UPDATE "users"
                         SET "${trafficColumn}" = GREATEST(CAST("${trafficColumn}" AS NUMERIC) - $1::numeric, 0)::text
                         WHERE "id" = $2
                         RETURNING "${trafficColumn}" AS balance`,
                        totalBytes.toString(),
                        proxy.userId,
                    );
                    const newBalance = BigInt(balanceRows[0]?.balance || '0');
                    
                    // Логируем использование трафика
                    await this.loggerService.log(
                        'USAGE',
                        `Пользователь ${proxy.userId} потратил ${totalBytes} байт трафика на ${typeLabel} прокси (логин ${login}).`,
                        proxy.userId || undefined,
                        {
                            used: totalBytes.toString(),
                            in: traffic.inBytes.toString(),
                            out: traffic.outBytes.toString(),
                            type: typeLabel,
                        },
                        true,
                    );

                    // Детальное логирование трафика
                    await this.loggerService.logTraffic({
                        userId: proxy.userId!,
                        packageType: typeLabel,
                        proxyType: proxy.type,
                        port: proxy.userPort ?? 0,
                        inBytes: traffic.inBytes,
                        outBytes: traffic.outBytes,
                    });
                    
                    // Если баланс закончился, находим ВСЕ прокси в пакете пользователя для блокировки
                    if (newBalance === 0n && proxy.status === ProxyStatus.ACTIVE) {
                        // Находим все активные прокси в том же пакете пользователя
                        const allPackageProxies = await this.prisma.proxy.findMany({
                            where: {
                                userPackageId: proxy.userPackageId,
                                status: ProxyStatus.ACTIVE,
                                userLogin: { not: null },
                            },
                        });
                        
                        for (const packageProxy of allPackageProxies) {
                            if (!proxiesToSuspend.find(p => p.id === packageProxy.id)) {
                                proxiesToSuspend.push({
                                    id: packageProxy.id,
                                    serverHost: packageProxy.serverHost,
                                    userLogin: packageProxy.userLogin,
                                    type: packageProxy.type,
                                });
                            }
                        }
                    }
                }
            }
            
            // Записываем трафик в TrafficLog по пакетам пользователя (по часам)
            if (trafficByPackage.size > 0) {
                const currentDate = new Date(now);
                currentDate.setMinutes(0, 0, 0); // Обнуляем минуты и секунды для группировки по часам
                const currentHour = currentDate.getHours();
                
                for (const [userPackageId, traffic] of trafficByPackage.entries()) {
                    try {
                        // Ищем существующую запись за текущий час
                        const existingLog = await this.prisma.trafficLog.findUnique({
                            where: {
                                userPackageId_date_hour: {
                                    userPackageId,
                                    date: currentDate,
                                    hour: currentHour,
                                },
                            },
                        });
                        
                        if (existingLog) {
                            // Обновляем существующую запись
                            await this.prisma.trafficLog.update({
                                where: { id: existingLog.id },
                                data: {
                                    inBytes: existingLog.inBytes + traffic.inBytes,
                                    outBytes: existingLog.outBytes + traffic.outBytes,
                                },
                            });
                        } else {
                            // Создаем новую запись
                            await this.prisma.trafficLog.create({
                                data: {
                                    userPackageId,
                                    date: currentDate,
                                    hour: currentHour,
                                    inBytes: traffic.inBytes,
                                    outBytes: traffic.outBytes,
                                },
                            });
                        }
                    } catch (error: any) {
                        // Логируем ошибку, но не прерываем обработку трафика
                        this.logger.error(`[TRAFFIC] Ошибка при записи TrafficLog для userPackage ${userPackageId}: ${error.message}`);
                    }
                }
            }
            
            // Блокируем прокси с нулевым балансом
            if (proxiesToSuspend.length > 0) {
                const proxyIds = proxiesToSuspend.map(p => p.id);
                await this.prisma.proxy.updateMany({
                    where: {
                        id: {
                            in: proxyIds,
                        },
                    },
                    data: {
                        status: ProxyStatus.SUSPENDED,
                    },
                });
                
                // V2: block-login по каждому логину
                for (const proxy of proxiesToSuspend) {
                    if (proxy.serverHost && proxy.userLogin) {
                        try {
                            const server = await this.prisma.proxyServer.findFirst({
                                where: { host: proxy.serverHost },
                                select: { token: true },
                            });
                            if (server?.token) {
                                await this.proxyServerService.blockLoginOnServer(proxy.serverHost, proxy.userLogin, server.token);
                            }
                        } catch (error: any) {
                            this.logger.error(`[TRAFFIC] Ошибка при блокировке логина ${proxy.userLogin} на ${proxy.serverHost}: ${error.message}`);
                        }
                    }
                }
                
                // ВАЖНО: Вызываем синхронизацию портов асинхронно, чтобы удалить заблокированные порты с серверов
                // syncActivePortsWithServers автоматически исключит SUSPENDED прокси из синхронизации
                // Вызываем асинхронно, чтобы не блокировать обработку трафика
                this.nodeService.syncActivePortsWithServers().catch((error: any) => {
                    this.logger.error(`[TRAFFIC] Ошибка при синхронизации портов после блокировки: ${error.message}`);
                });
                this.logger.log(`[TRAFFIC] заблокировано прокси: ${proxiesToSuspend.length}, запланирован sync портов`);
            }
        }
        
        return { success: true, message: 'Traffic received' };
    }
}
