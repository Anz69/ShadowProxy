import { BadRequestException, forwardRef, HttpException, Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, PackageType, ProxyStatus } from "@prisma/client";
import { CreatePackageDto } from "./dto/create-package.dto";
import { UpdatePackageDto } from "./dto/update-package.dto";
import { GeneratePackageProxyDto } from "./dto/generate-package-proxy.dto";
import { ProxyServerService } from "../proxy-server/proxy-server.service";
import { MangoProxyProvider } from "../proxy/providers/services/mango-proxy.provider";
import { MobileGbProvider } from "../proxy/providers/services/mobile-gb.provider";
import { IspUsaProvider } from "../proxy/providers/services/isp-usa.provider";
import { IspEuProvider } from "../proxy/providers/services/isp-eu.provider";
import { ResidentialLiteProvider } from "../proxy/providers/services/residential-lite.provider";
import { UserService } from "../user/user.service";
import { buildProxyLogin, generatePasswordV2, PROXY_SERVER_PORT } from "../shared/utils/hash-credentials";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ProxyService } from "../proxy/proxy.service";
import { IssueMobileGbProxyDto } from "../proxy/dtos/issue-mobile-gb-proxy.dto";
import { LoggerService } from "../logger/logger.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { isMobileGbCountryAllowed } from "../shared/constants/mobile-gb-allowed-countries";
import { isProxyTypeDisabled } from "../shared/constants/sprint-gating";

@Injectable()
export class PackageService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly proxyServerService: ProxyServerService,
        private readonly mangoProxyProvider: MangoProxyProvider,
        private readonly mobileGbProvider: MobileGbProvider,
        private readonly ispUsaProvider: IspUsaProvider,
        private readonly ispEuProvider: IspEuProvider,
        private readonly residentialLiteProvider: ResidentialLiteProvider,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        @Inject(forwardRef(() => ProxyService))
        private readonly proxyService: ProxyService,
        private readonly logger: LoggerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    findMany(query: Prisma.PackageFindManyArgs) {
        return this.prisma.package.findMany(query);
    }

    findById(id: string) {
        return this.prisma.package.findUnique({
            where: { id },
        });
    }

    async getUserPackageInfo(userPackageId: string, userId: string) {
        const userPackage = await this.prisma.userPackage.findUnique({
            where: { id: userPackageId },
        });

        if (!userPackage) {
            throw new NotFoundException("errors.package_not_found");
        }

        if (userPackage.userId !== userId) {
            throw new BadRequestException("Пакет не принадлежит этому пользователю");
        }

        const pkg = userPackage as any;
        
        // Вычисляем оставшееся время аренды
        let remainingSeconds: number | null = null;
        if (pkg.rentTime && pkg.createdAt) {
            const expirationTime = new Date(pkg.createdAt.getTime() + pkg.rentTime * 1000);
            const now = new Date();
            const remaining = Math.floor((expirationTime.getTime() - now.getTime()) / 1000);
            remainingSeconds = remaining > 0 ? remaining : 0;
        }

        return {
            id: userPackage.id,
            type: pkg.type,
            planId: pkg.planId,
            rentTime: pkg.rentTime,
            remainingSeconds,
            createdAt: userPackage.createdAt,
            updatedAt: userPackage.updatedAt,
        };
    }

    create(dto: CreatePackageDto) {
        return this.prisma.package.create({
            data: {
                ...dto,
                traffic: dto.type === "IPV6_GB" ? dto.traffic.toString() : BigInt(Math.round(dto.traffic * 1024 ** 3)).toString(),
            },
        });
    }

    async delete(id: string) {
        const isExists = await this.findById(id);
        if (!isExists) {
            throw new NotFoundException("errors.package_not_found");
        }
        await this.prisma.package.delete({
            where: {
                id,
            },
        });

        return {
            success: true,
        };
    }

    async update(id: string, dto: UpdatePackageDto) {
        const isExists = await this.findById(id);
        if (!isExists) {
            throw new NotFoundException("errors.package_not_found");
        }
        return this.prisma.package.update({
            where: {
                id,
            },
            data: {
                ...dto,
                traffic: dto.type === "IPV6_GB" ? dto.traffic.toString() : BigInt(Math.round(dto.traffic * 1024 ** 3)).toString(),
            },
        });
    }

    // Получение статистики трафика по пакету пользователя
    async getTrafficStats(
        userPackageId: string,
        startDate: Date,
        endDate: Date,
        groupBy: 'hour' | 'day' = 'day'
    ) {
        // Проверяем что UserPackage существует
        const userPackage = await this.prisma.userPackage.findUnique({
            where: { id: userPackageId },
        });

        if (!userPackage) {
            throw new NotFoundException("errors.package_not_found");
        }

        // Нормализуем даты (убираем время для корректного сравнения)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Получаем все логи за указанный период для конкретного UserPackage
        const logs = await this.prisma.trafficLog.findMany({
            where: {
                userPackageId,
                date: {
                    gte: start,
                    lte: end,
                },
            },
            orderBy: [
                { date: 'asc' },
                { hour: 'asc' },
            ],
        });

        // Группируем данные
        const grouped: Record<string, { inBytes: bigint; outBytes: bigint; date: Date; hour?: number }> = {};

        for (const log of logs) {
            let key: string;
            let date: Date;

            if (groupBy === 'hour') {
                // Группировка по часам
                date = new Date(log.date);
                date.setHours(log.hour, 0, 0, 0);
                key = `${date.toISOString()}_${log.hour}`;
            } else {
                // Группировка по дням (суммируем все часы за день)
                date = new Date(log.date);
                date.setHours(0, 0, 0, 0);
                key = date.toISOString().split('T')[0];
            }

            if (!grouped[key]) {
                grouped[key] = {
                    inBytes: 0n,
                    outBytes: 0n,
                    date,
                    hour: groupBy === 'hour' ? log.hour : undefined,
                };
            }

            grouped[key].inBytes += log.inBytes;
            grouped[key].outBytes += log.outBytes;
        }

        // Преобразуем в массив и сортируем по дате
        return Object.values(grouped)
            .map(item => ({
                date: item.date.toISOString(),
                hour: item.hour,
                inBytes: item.inBytes.toString(),
                outBytes: item.outBytes.toString(),
                totalBytes: (item.inBytes + item.outBytes).toString(),
            }))
            .sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateA - dateB;
                // Если даты одинаковые, сортируем по часам
                return (a.hour || 0) - (b.hour || 0);
            });
    }

    // Получение первой и последней даты логов для пакета пользователя
    async getTrafficLogBounds(userPackageId: string) {
        // Проверяем что UserPackage существует
        const userPackage = await this.prisma.userPackage.findUnique({
            where: { id: userPackageId },
        });

        if (!userPackage) {
            throw new NotFoundException("errors.package_not_found");
        }

        const firstLog = await this.prisma.trafficLog.findFirst({
            where: { userPackageId },
            orderBy: { date: 'asc' },
            select: { date: true },
        });

        const lastLog = await this.prisma.trafficLog.findFirst({
            where: { userPackageId },
            orderBy: { date: 'desc' },
            select: { date: true },
        });

        return {
            firstDate: firstLog?.date || null,
            lastDate: lastLog?.date || null,
        };
    }

    async activatePackage(packageId: string, userId: string) {
        const packageToActivate = await this.findById(packageId);
        if (!packageToActivate) {
            throw new NotFoundException("errors.package_not_found");
        }

        // Проверяем, есть ли у пользователя уже пакет этого типа
        const existingUserPackage = await this.prisma.userPackage.findFirst({
            where: {
                userId,
                type: packageToActivate.type,
            },
        });

        if (existingUserPackage) {
            throw new BadRequestException("errors.package_already_activated");
        }

        // Создаем UserPackage только с типом (без привязки к конкретному Package)
        return this.prisma.userPackage.create({
            data: {
                userId,
                type: packageToActivate.type, // Сохраняем тип прокси (тариф)
            },
        });
    }

    async getUserPackages(userId: string) {
        const userPackages = await this.prisma.userPackage.findMany({
            where: {
                userId,
            },
        });

        // Для пакетов по ГБ — только счётчик, список не грузим. Для MOBILE (аренда по времени) — список прокси из БД.
        const packagesWithCount = await Promise.all(
            userPackages.map(async (userPackage) => {
                const userPkgData = userPackage as any;

                // Израсходованный трафик по пакету = сумма traffic_logs (in+out).
                // total куплено = остаток (*TrafficLeft на юзере) + usedTraffic →
                // фронт строит полоску «осталось из купленного».
                const trafficAgg = await this.prisma.trafficLog.aggregate({
                    where: { userPackageId: userPackage.id },
                    _sum: { inBytes: true, outBytes: true },
                });
                const usedTraffic = String(
                    (trafficAgg._sum.inBytes ?? 0n) + (trafficAgg._sum.outBytes ?? 0n),
                );

                if (userPackage.type === "MOBILE") {
                    const mobileProxies = await this.prisma.proxy.findMany({
                        where: {
                            userPackageId: userPackage.id,
                            type: "MOBILE",
                        },
                        orderBy: { createdAt: "desc" },
                        select: {
                            id: true,
                            host: true,
                            port: true,
                            username: true,
                            password: true,
                            country: true,
                            status: true,
                            serverHost: true,
                            createdAt: true,
                            rentTime: true,
                        },
                    });

                    const activeProxies = mobileProxies.map((p) => ({
                        id: p.id,
                        host: p.host,
                        port: p.port,
                        username: p.username,
                        password: p.password,
                        login: p.username,
                        country: p.country,
                        status: p.status,
                        serverHost: this.proxyServerService.getPublicHost(p.serverHost ?? p.host),
                        createdAt: p.createdAt,
                        rentTime: p.rentTime,
                    }));

                    return {
                        ...userPackage,
                        planId: userPkgData.planId || null,
                        activeProxies,
                        proxiesCount: mobileProxies.length,
                        usedTraffic,
                    };
                }

                const proxiesCount = await this.prisma.proxy.count({
                    where: {
                        userPackageId: userPackage.id as any,
                        OR: [
                            {
                                userPort: { not: { equals: null } } as any,
                                userLogin: { not: { equals: null } } as any,
                                userPassword: { not: { equals: null } } as any,
                            },
                            {
                                type: "MOBILE",
                            },
                        ],
                    },
                });

                return {
                    ...userPackage,
                    planId: userPkgData.planId || null,
                    activeProxies: [],
                    proxiesCount,
                    usedTraffic,
                };
            })
        );

        return packagesWithCount;
    }

    async activatePackageByType(type: PackageType, userId: string) {
        if (type === "RESIDENT") {
            throw new BadRequestException("Тип RESIDENT (Luna) больше не поддерживается. Используйте RESIDENT_PREMIUM.");
        }
        // Check if user already has this package type activated
        const existingUserPackage = await this.prisma.userPackage.findFirst({
            where: {
                userId,
                type,
            },
        });

        if (existingUserPackage) {
            return existingUserPackage;
        }

        // Create UserPackage only with type (without creating Package)
        return this.prisma.userPackage.create({
            data: {
                userId,
                type, // Сохраняем тип прокси (тариф)
            },
        });
    }

    private getDefaultPrice(type: PackageType): number {
        const defaultPrices: Record<PackageType, number> = {
            RESIDENT: 0.77,
            RESIDENT_PREMIUM: 1.2,
            MOBILE: 2.5,
            MOBILE_GB: 0.5,
            IPV6_GB: 5.0,
            PREMIUM_RESIDENTIAL: 1.5,
            ISP_USA: 1.5,
            ISP_EU: 1.5,
            RESIDENTIAL_LITE: 0.9,
        };
        return defaultPrices[type] || 1.0;
    }

    /**
     * Создает пакет для пользователя, если у него еще нет пакетов этого типа
     * @param type Тип пакета
     * @param traffic Трафик в байтах (для всех типов по ГБ: RESIDENT, RESIDENT_PREMIUM, IPV6_GB, MOBILE_GB)
     * @param userId ID пользователя
     */
    async createPackageIfNotExists(type: PackageType, traffic: string, userId: string) {
        // Проверяем, есть ли у пользователя уже пакеты этого типа
        const existingUserPackage = await this.prisma.userPackage.findUnique({
            where: {
                userId_type: {
                    userId,
                    type,
                },
            },
        });

        if (existingUserPackage) {
            return existingUserPackage; // У пользователя уже есть пакет этого типа
        }

        // Создаем UserPackage только с типом (без создания Package)
        return await this.prisma.userPackage.create({
            data: {
                userId,
                type, // Сохраняем тип прокси (тариф)
            },
        });
    }

    // Ограничитель параллельности фоновых health-check'ов. При генерации крупной пачки
    // (напр. 1000 прокси) каждый прокси запускает фоновую проверку; без лимита это до 1000
    // одновременных запросов через гейтвей в апстрим → апстрим захлёбывается, проверки
    // ложно таймаутят, прокси массово уходят в SUSPENDED («часть не работает»). Держим не
    // более HEALTH_CHECK_MAX проверок разом (глобально, сервис — singleton).
    private healthCheckActive = 0;
    private readonly healthCheckQueue: Array<() => void> = [];
    private readonly HEALTH_CHECK_MAX = 6;

    private acquireHealthSlot(): Promise<void> {
        if (this.healthCheckActive < this.HEALTH_CHECK_MAX) {
            this.healthCheckActive++;
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => this.healthCheckQueue.push(resolve));
    }

    private releaseHealthSlot(): void {
        const next = this.healthCheckQueue.shift();
        if (next) {
            next(); // слот переходит следующему ожидающему, active не меняем
        } else {
            this.healthCheckActive = Math.max(0, this.healthCheckActive - 1);
        }
    }

    // V2: логин = package-{hash}-{providerUsername}[-{i}], пароль уникален.
    // startIteration — порядковый номер прокси в пачке (quantity>1). Каждому проксИ в
    // пачке даём свой суффикс -0/-1/-2…, иначе все 5 получают ОДИН логин и выходят
    // одинаковыми. Повторная генерация того же пакета переиспользует существующие
    // логины (идемпотентно), новые логины на занятые другим пакетом слоты — со сдвигом.
    private async generateCredentialsV2(
        userPackageId: string,
        providerUsername: string,
        serverHost: string,
        startIteration: number = 0,
        maxAttempts: number = 10
    ): Promise<{ login: string; password: string }> {
        for (let k = 0; k < maxAttempts; k++) {
            const i = startIteration + k;
            const login = i === 0
                ? buildProxyLogin(userPackageId, providerUsername)
                : `${buildProxyLogin(userPackageId, providerUsername)}-${i}`;
            const password = generatePasswordV2(userPackageId, providerUsername, i);

            const existingProxy = await this.prisma.proxy.findFirst({
                where: { serverHost, userLogin: login },
            });

            if (!existingProxy) {
                return { login, password };
            }

            if (existingProxy.userPackageId === userPackageId) {
                if (!existingProxy.userPassword?.length) {
                    throw new BadRequestException("Сохранённый прокси без пароля, обратитесь в поддержку");
                }
                return { login: existingProxy.userLogin!, password: existingProxy.userPassword };
            }

            console.log(
                `[PackageService] Логин ${login} занят другим пакетом на ${serverHost}, пробуем итерацию ${i + 1}`,
            );
        }
        throw new BadRequestException(`Не удалось сгенерировать уникальный логин после ${maxAttempts} попыток`);
    }

    async generatePackageProxy(packageId: string, dto: GeneratePackageProxyDto, userId: string) {
        // Ищем UserPackage по packageId (в URL это userPackageId, а не package.id)
        const userPackage = await this.prisma.userPackage.findUnique({
            where: {
                id: packageId,
            },
        });

        if (!userPackage) {
            throw new NotFoundException("errors.package_not_found");
        }

        // Проверяем, что пакет принадлежит пользователю
        if (userPackage.userId !== userId) {
            throw new BadRequestException("Пакет не принадлежит этому пользователю");
        }

        const packageType = (userPackage as any).type;

        // Проверяем, что тип поддерживается
        if (!["RESIDENT_PREMIUM", "IPV6_GB", "MOBILE_GB", "MOBILE", "PREMIUM_RESIDENTIAL", "ISP_USA", "ISP_EU", "RESIDENTIAL_LITE"].includes(packageType)) {
            throw new BadRequestException(`Генерация прокси не поддерживается для типа ${packageType}`);
        }
        // Спринт-гейтинг: отключённые типы (напр. ISP_EU/Lite в Sprint 2) блокируем.
        if (isProxyTypeDisabled(packageType)) {
            throw new BadRequestException("errors.proxy_type_unavailable");
        }

        if (packageType === "PREMIUM_RESIDENTIAL") {
            const rotation = (dto as any).rotation as "BY_REQUEST" | "BY_TIME" | undefined;
            const rotationInterval = (dto as any).rotationInterval as number | undefined;
            const directIpRotationType = (dto as any).ip_rotation_type as "random" | "sticky" | "custom" | undefined;
            const directSessionLifetime = (dto as any).session_lifetime as number | undefined;

            let ipRotationType: "random" | "sticky" | "custom" | undefined = directIpRotationType;
            let sessionLifetime: number | undefined = directSessionLifetime;
            if (!ipRotationType && rotation === "BY_REQUEST") {
                ipRotationType = "random";
            } else if (!ipRotationType && rotation === "BY_TIME") {
                ipRotationType = "custom";
                sessionLifetime = sessionLifetime ?? Math.max(1, Math.min(120, rotationInterval ?? 10));
            }

            const proxies = await this.proxyService.issuePremiumResidentialProxy(
                {
                    location: dto.location || undefined,
                    region: (dto as any).region || undefined,
                    city: (dto as any).city || undefined,
                    isp: (dto as any).isp || undefined,
                    ip_rotation_type: ipRotationType,
                    session_lifetime: sessionLifetime,
                    quantity: dto.quantity || 1,
                } as any,
                userId,
            );

            const proxyIds = (proxies as any[]).map((p: any) => p.id);
            if (proxyIds.length > 0) {
                await this.prisma.proxy.updateMany({
                    where: { id: { in: proxyIds } },
                    data: { userPackageId: userPackage.id } as any,
                });
            }

            return (proxies as any[]).map((p: any) => ({
                proxyPort: {
                    id: p.id,
                    port: p.port,
                    login: p.userLogin,
                    password: p.userPassword,
                    serverHost: p.host,
                },
            })) as any;
        }

        // Для MOBILE прокси используем прямую генерацию от провайдера (без прокси-сервера)
        if (packageType === "MOBILE") {
            const userPackageData = userPackage as any;
            const planId = userPackageData.planId;
            const rentTime = userPackageData.rentTime;

            if (!planId || !rentTime) {
                const proxies = await this.proxyService.issueMobileV2Proxy(
                    {
                        location: dto.location || undefined,
                        region: (dto as any).region || undefined,
                        city: (dto as any).city || undefined,
                        isp: (dto as any).isp || undefined,
                        quantity: dto.quantity || 1,
                    } as any,
                    userId,
                );

                const proxyIds = (proxies as any[]).map((p: any) => p.id);
                if (proxyIds.length > 0) {
                    await this.prisma.proxy.updateMany({
                        where: { id: { in: proxyIds } },
                        data: { userPackageId: userPackage.id } as any,
                    });
                }

                return (proxies as any[]).map((p: any) => ({
                    proxyPort: {
                        id: p.id,
                        port: p.port,
                        login: p.userLogin,
                        password: p.userPassword,
                        serverHost: p.host,
                    },
                })) as any;
            }

            // Проверяем, что время пакета не истекло
            const now = new Date();
            const expirationTime = userPackageData.createdAt && rentTime
                ? new Date(userPackageData.createdAt.getTime() + rentTime * 1000)
                : null;

            if (expirationTime && now >= expirationTime) {
                throw new BadRequestException("Время аренды пакета истекло. Пожалуйста, продлите аренду перед созданием прокси.");
            }

            const user = await this.userService.findById(userId, true, false);
            if (!user) {
                throw new NotFoundException("errors.user_not_found");
            }

            // Генерируем прокси напрямую через провайдера (без прокси-сервера)
            const quantity = dto.quantity || 1;
            const createdProxies: any[] = [];

            this.logger.log("SYSTEM", `Начало генерации MOBILE прокси для пакета ${packageId}: planId=${planId}, rentTime=${rentTime}, quantity=${quantity}`, userId);

            for (let i = 0; i < quantity; i++) {
                try {
                    this.logger.log("SYSTEM", `Попытка создания MOBILE прокси ${i + 1}/${quantity} для planId=${planId}`, userId);
                    const proxy = await this.proxyService.issueMobileProxy(planId, rentTime, user);
                    if (proxy) {
                        this.logger.log("SYSTEM", `MOBILE прокси успешно создан: ${proxy.id}`, userId);
                        // Обновляем userPackageId для созданного прокси
                        await this.prisma.proxy.update({
                            where: { id: proxy.id },
                            data: {
                                userPackageId: userPackage.id as any,
                            } as any,
                        });
                        createdProxies.push(proxy);
                    } else {
                        this.logger.log("SYSTEM", `MOBILE прокси не был создан (вернулся null) для planId=${planId}`, userId);
                    }
                } catch (error: any) {
                    this.logger.error(`Ошибка при создании MOBILE прокси ${i + 1}/${quantity} для planId=${planId}: ${error?.message || String(error)}`, userId, error);
                }
            }

            this.logger.log("SYSTEM", `Завершена генерация MOBILE прокси: создано ${createdProxies.length} из ${quantity}`, userId);

            return {
                success: true,
                proxies: createdProxies.map((p: any) => ({
                    id: p.id,
                    host: p.host,
                    port: p.port,
                    username: p.username,
                    password: p.password,
                    country: p.country,
                })),
            } as any;
        }

        // Для типов пакетов, требующих location, проверяем его наличие и валидность
        let validatedLocation: string | undefined = undefined;
        if (["RESIDENT", "RESIDENT_PREMIUM", "IPV6_GB", "MOBILE_GB"].includes(packageType)) {
            if (!dto.location || dto.location.trim() === "") {
                throw new BadRequestException("location обязателен для данного типа пакета");
            }
            validatedLocation = dto.location.trim();
            if (validatedLocation.length < 2) {
                throw new BadRequestException("Поле \"Локация\" не может быть короче 2 символов");
            }
            // Для IPv6 доступны только Германия (DE) и Нидерланды (NL)
            if (packageType === "IPV6_GB") {
                const validIpv6Locations = ["de", "nl"];
                if (!validIpv6Locations.includes(validatedLocation.toLowerCase())) {
                    throw new BadRequestException("Для IPv6 доступны только Германия (DE) и Нидерланды (NL)");
                }
            } else {
                // Проверяем формат ISO 3166-1 alpha-2 для других типов
                const iso3166Alpha2Regex = /^[A-Z]{2}$/i;
                if (!iso3166Alpha2Regex.test(validatedLocation)) {
                    throw new BadRequestException("Неверный формат локации");
                }
                if (packageType === "MOBILE_GB" && !isMobileGbCountryAllowed(validatedLocation)) {
                    throw new BadRequestException("Страна недоступна для мобильных прокси по ГБ");
                }
            }
        } else if (["ISP_EU", "RESIDENTIAL_LITE"].includes(packageType as string)) {
            // ISP_EU: мультигео (ISO-коды через запятую, напр. "DE,FR,NL").
            // RESIDENTIAL_LITE: одна страна (ISO-2). Глубокую валидацию делает сам провайдер
            // (allowed-список / формат), здесь только проверяем наличие.
            if (!dto.location || dto.location.trim() === "") {
                throw new BadRequestException("location обязателен для данного типа пакета");
            }
            validatedLocation = dto.location.trim();
        }

        // Проверяем баланс трафика
        let user = await this.userService.findById(userId, true, false);
        let trafficLeft: string | number = "0";
        
        if (packageType === "RESIDENT_PREMIUM") {
            trafficLeft = user.premiumTrafficLeft;
        } else if (packageType === "IPV6_GB") {
            trafficLeft = (user as any).ipv6GbTrafficLeft || "0";
        } else if (packageType === "MOBILE_GB") {
            trafficLeft = (user as any).mobileGbTrafficLeft || "0";
        } else if ((packageType as string) === "ISP_USA") {
            trafficLeft = (user as any).ispUsaTrafficLeft || "0";
        } else if ((packageType as string) === "ISP_EU") {
            trafficLeft = (user as any).ispEuTrafficLeft || "0";
        } else if ((packageType as string) === "RESIDENTIAL_LITE") {
            trafficLeft = (user as any).residentialLiteTrafficLeft || "0";
        }

        if (BigInt(String(trafficLeft)) < 1024n ** 2n) {
            throw new HttpException("errors.insufficient_balance", 402);
        }

        // Определяем количество прокси для генерации (по умолчанию 1)
        const quantity = dto.quantity || 1;
        const rotation = dto.rotation || "BY_REQUEST";

        // Проверяем, что для BY_TIME передан rotationInterval
        if (rotation === "BY_TIME" && !dto.rotationInterval) {
            throw new BadRequestException("rotationInterval обязателен для ротации по времени");
        }

        const results: Array<{
            proxyPort: {
                id: string;
                port: number;
                login: string;
                password: string;
                serverHost: string;
            };
        }> = [];

        if (!this.proxyService.isNodeGatewayEnabled()) {
            for (let i = 0; i < quantity; i++) {
                let rotationTime: number | undefined = undefined;
                if (rotation === "BY_TIME") {
                    if (!dto.rotationInterval || dto.rotationInterval < 5) {
                        throw new BadRequestException("rotationInterval должен быть не менее 5 минут для ротации по времени");
                    }
                    rotationTime = dto.rotationInterval;
                }

                if (packageType === "RESIDENT_PREMIUM" && !user.premiumUsername?.length) {
                    await this.eventEmitter.emitAsync("proxy.create_account", { userId, type: "RESIDENT_PREMIUM" });
                    const refreshed = await this.userService.findById(userId, true, false);
                    if (!refreshed.premiumUsername?.length) {
                        throw new BadRequestException("Не удалось создать аккаунт Mango Proxy. Обратитесь в поддержку.");
                    }
                    user = refreshed;
                }

                let providerProxy: { host: string; port: number; username: string; password: string };
                if (packageType === "MOBILE_GB") {
                    if (!validatedLocation) throw new BadRequestException("location обязателен для MOBILE_GB пакетов");
                    providerProxy = this.mobileGbProvider.createProxy(validatedLocation, rotationTime);
                } else if (packageType === "RESIDENT_PREMIUM") {
                    if (!validatedLocation) throw new BadRequestException("location обязателен для данного типа пакета");
                    providerProxy = await this.mangoProxyProvider.createProxy(
                        validatedLocation,
                        user.region,
                        user,
                        rotationTime,
                        { state: dto.region, city: dto.city, asn: dto.isp },
                    );
                } else {
                    throw new BadRequestException(`Тип пакета ${packageType} не поддерживает прямую генерацию через этот метод`);
                }

                const isWorking = await this.proxyService.testProviderProxyConnection(
                    providerProxy.host,
                    providerProxy.port,
                    providerProxy.username,
                    providerProxy.password,
                );
                if (!isWorking) {
                    this.logger.log("SYSTEM", `❌ ${packageType} провайдерский прокси не работает: ${providerProxy.host}:${providerProxy.port}`, userId);
                    continue;
                }

                const proxy = await this.prisma.proxy.create({
                    data: {
                        host: providerProxy.host,
                        port: providerProxy.port,
                        username: providerProxy.username,
                        password: providerProxy.password,
                        type: packageType as any,
                        rotation: rotation as "BY_REQUEST" | "BY_TIME",
                        rotationInterval: rotation === "BY_TIME" ? dto.rotationInterval : null,
                        country: dto.location,
                        userId,
                        userPort: providerProxy.port,
                        userLogin: providerProxy.username,
                        userPassword: providerProxy.password,
                        serverHost: null,
                        userPackageId: userPackage.id,
                        status: ProxyStatus.ACTIVE,
                    } as any,
                });

                results.push({
                    proxyPort: {
                        id: proxy.id,
                        port: providerProxy.port,
                        login: providerProxy.username,
                        password: providerProxy.password,
                        serverHost: providerProxy.host,
                    },
                });
            }

            if (!results.length) {
                throw new InternalServerErrorException("errors.proxy_unknown_error");
            }
            return results;
        }

        for (let i = 0; i < quantity; i++) {
            const { serverHost } = await this.proxyServerService.getServerForProxy();

            const server = await this.prisma.proxyServer.findFirst({
                where: { host: serverHost },
            });

            if (!server) {
                throw new BadRequestException(`Сервер ${serverHost} не найден`);
            }

            let rotationTime: number | undefined = undefined;
            if (rotation === "BY_TIME") {
                // Новые типы (ISP_USA/ISP_EU/RESIDENTIAL_LITE): лимит времени по ТЗ 1–1440 мин;
                // остальные типы — минимум 5.
                const newGatewayTypes = ["ISP_USA", "ISP_EU", "RESIDENTIAL_LITE"];
                const isNewGatewayType = newGatewayTypes.includes(packageType as string);
                const minInterval = isNewGatewayType ? 1 : 5;
                if (!dto.rotationInterval || dto.rotationInterval < minInterval) {
                    throw new BadRequestException(`rotationInterval должен быть не менее ${minInterval} минут для ротации по времени`);
                }
                if (isNewGatewayType && dto.rotationInterval > 1440) {
                    throw new BadRequestException("validation.rotation_max_1440");
                }
                rotationTime = dto.rotationInterval;
            }

            // RESIDENT_PREMIUM: убедиться, что аккаунт провайдера создан
            if (packageType === "RESIDENT_PREMIUM" && !user.premiumUsername?.length) {
                await this.eventEmitter.emitAsync("proxy.create_account", { userId, type: "RESIDENT_PREMIUM" });
                const refreshed = await this.userService.findById(userId, true, false);
                if (!refreshed.premiumUsername?.length) {
                    throw new BadRequestException("Не удалось создать аккаунт Mango Proxy. Обратитесь в поддержку.");
                }
                user = refreshed;
            }

            // RESIDENT_PREMIUM: разблокировать суб-аккаунт Mango (flow на стороне Mango),
            // иначе апстрим Mango отдаёт 403 «нет трафика». Реальный лимит юзера — у нас.
            // Идемпотентно (проверяет остаток), покрывает и новые, и существующие аккаунты.
            if (packageType === "RESIDENT_PREMIUM") {
                await this.mangoProxyProvider.ensureMangoFlow(user.premiumUsername);
            }

            let providerProxy: { host: string; port: number; username: string; password: string };
            if (packageType === "MOBILE_GB") {
                if (!validatedLocation) throw new BadRequestException("location обязателен для MOBILE_GB пакетов");
                providerProxy = this.mobileGbProvider.createProxy(validatedLocation, rotationTime);
            } else if ((packageType as string) === "ISP_USA") {
                // ISP_USA: страна фиксирована (US), гео не выбирается. Провайдер собирает
                // upstream-строку (beta.flashproxy.io), клиентские креды/serverHost — ниже.
                providerProxy = this.ispUsaProvider.createProxy(rotationTime);
            } else if ((packageType as string) === "ISP_EU") {
                // ISP_EU: мультигео — validatedLocation = ISO-коды через запятую (DE,FR,NL).
                // Провайдер валидирует каждую страну по allowed-списку и собирает upstream.
                if (!validatedLocation) throw new BadRequestException("location обязателен для ISP_EU пакетов");
                providerProxy = this.ispEuProvider.createProxy(validatedLocation, rotationTime);
            } else if ((packageType as string) === "RESIDENTIAL_LITE") {
                // RESIDENTIAL_LITE: любая страна (ISO-2). Провайдер собирает upstream (lite.flashproxy.io).
                if (!validatedLocation) throw new BadRequestException("location обязателен для RESIDENTIAL_LITE пакетов");
                providerProxy = this.residentialLiteProvider.createProxy(validatedLocation, rotationTime);
            } else if (packageType === "RESIDENT_PREMIUM") {
                if (!validatedLocation) throw new BadRequestException("location обязателен для данного типа пакета");
                providerProxy = await this.mangoProxyProvider.createProxy(
                    validatedLocation,
                    user.region,
                    user,
                    rotationTime,
                    { state: dto.region, city: dto.city, asn: dto.isp },
                );
            } else {
                throw new BadRequestException(`Тип пакета ${packageType} не поддерживает генерацию прокси через этот метод`);
            }

            // Логин: package-{hash}-{providerUsername}-{i}. Передаём индекс пачки i,
            // чтобы каждый из quantity прокси получил СВОЙ логин (иначе все одинаковые).
            const { login, password } = await this.generateCredentialsV2(
                userPackage.id,
                providerProxy.username,
                serverHost,
                i
            );

            const existingSamePackageOnServer = await this.prisma.proxy.findFirst({
                where: {
                    userPackageId: userPackage.id,
                    serverHost,
                    userLogin: login,
                },
            });

            if (existingSamePackageOnServer) {
                results.push({
                    proxyPort: {
                        id: existingSamePackageOnServer.id,
                        port: existingSamePackageOnServer.userPort!,
                        login: existingSamePackageOnServer.userLogin!,
                        password: existingSamePackageOnServer.userPassword!,
                        serverHost: this.proxyServerService.getPublicHost(existingSamePackageOnServer.serverHost || serverHost),
                    },
                });
                continue;
            }

            const port = PROXY_SERVER_PORT;
            if (server.token) {
                await this.proxyServerService.activatePortOnServer(
                    server.host,
                    port,
                    login,
                    password,
                    providerProxy.host,
                    providerProxy.port,
                    providerProxy.username,
                    providerProxy.password,
                    server.token
                );
            } else {
                console.warn(`[PACKAGE SERVICE] Сервер ${server.host} не имеет токена для активации`);
            }

            // Создаём запись и отдаём прокси пользователю СРАЗУ (ТЗ п.7.1: не блокировать
            // ответ медленной живой проверкой). Реальный HTTPS-тест через прокси выносим
            // в фон — при неудаче помечаем прокси SUSPENDED и блокируем логин на сервере.
            const proxy = await this.prisma.proxy.create({
                data: {
                    host: providerProxy.host,
                    port: providerProxy.port,
                    username: providerProxy.username,
                    password: providerProxy.password,
                    type: packageType as any,
                    rotation: rotation as "BY_REQUEST" | "BY_TIME",
                    rotationInterval: rotation === "BY_TIME" ? dto.rotationInterval : null,
                    // ISP_USA: страна фиксирована (US), location от клиента может не прийти.
                    country: (packageType as string) === "ISP_USA" ? "US" : (dto.location || validatedLocation || ""),
                    userId,
                    serverHost,
                    userPackageId: userPackage.id as any,
                    userPort: port,
                    userLogin: login,
                    userPassword: password,
                    lastActivityAt: new Date(),
                } as any,
            });

            results.push({
                proxyPort: {
                    id: proxy.id,
                    port: proxy.userPort!,
                    login: proxy.userLogin!,
                    password: proxy.userPassword!,
                    serverHost: this.proxyServerService.getPublicHost(proxy.serverHost || serverHost),
                },
            });

            // Фоновая верификация (не блокирует ответ).
            const verifyHost = server.host;
            const verifyToken = server.token;
            void (async () => {
                await this.acquireHealthSlot();
                try {
                    const ok = await this.proxyService.verifyIssuedProxyWorks(verifyHost, port, login, password);
                    if (ok) return;
                    if (verifyToken) {
                        try {
                            await this.proxyServerService.blockLoginOnServer(verifyHost, login, verifyToken);
                        } catch (e) {
                            console.error(`[PACKAGE SERVICE] Не удалось заблокировать логин после фоновой проверки: ${e}`);
                        }
                    }
                    await this.prisma.proxy.update({
                        where: { id: proxy.id },
                        data: { status: "SUSPENDED" as any },
                    });
                    console.warn(`[PACKAGE SERVICE] Прокси ${proxy.id} не прошёл фоновую проверку → SUSPENDED`);
                } catch (e) {
                    console.error(`[PACKAGE SERVICE] Фоновая проверка прокси ${proxy.id} упала: ${e}`);
                } finally {
                    this.releaseHealthSlot();
                }
            })();
        }

        // Логируем генерацию прокси
        await this.logger.logUserAction({
            userId,
            actionType: "PROXY_GENERATE",
            message: `Пользователь ${userId} сгенерировал ${quantity} прокси для пакета ${packageId} (тип: ${packageType}${dto.location ? `, страна: ${dto.location}` : ""})`,
            metadata: {
                packageId,
                packageType,
                quantity,
                location: dto.location || null,
                rotation: dto.rotation,
                rotationInterval: dto.rotationInterval,
            },
        });

        // Возвращаем массив результатов (для обратной совместимости возвращаем первый, если quantity=1)
        return quantity === 1 ? results[0] : results;
    }

    @Cron(CronExpression.EVERY_HOUR)
    async deleteOldInactivePackages() {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        // Находим пользовательские пакеты, которые:
        // 1. Не обновлялись больше 7 дней
        // 2. Не имеют привязанных прокси (0 прокси)
        const oldUserPackages = await this.prisma.userPackage.findMany({
            where: {
                updatedAt: {
                    lt: weekAgo,
                },
            },
            include: {
                _count: {
                    select: { proxies: true },
                },
            },
        });

        // Фильтруем только те, у которых 0 прокси
        const packagesToDelete = oldUserPackages.filter(pkg => pkg._count.proxies === 0);

        if (packagesToDelete.length === 0) {
            return 0;
        }

        console.log(`[PACKAGE SERVICE] Найдено ${packagesToDelete.length} пакетов для удаления (0 прокси + >7 дней без обновления)`);

        let deletedCount = 0;

        for (const userPkg of packagesToDelete) {
            try {
                await this.prisma.userPackage.delete({
                    where: {
                        id: userPkg.id,
                    },
                });

                deletedCount++;
                console.log(`[PACKAGE SERVICE] UserPackage ${userPkg.id} удален (0 прокси, последнее обновление: ${userPkg.updatedAt})`);
            } catch (error: any) {
                console.error(`[PACKAGE SERVICE] Ошибка при удалении UserPackage ${userPkg.id}: ${error.message}`);
            }
        }

        if (deletedCount > 0) {
            console.log(`[PACKAGE SERVICE] Удалено ${deletedCount} старых пустых пользовательских пакетов`);
        }

        return deletedCount;
    }

    /**
     * Восстановление ошибочно засуспенженных by-GB прокси через гейтвей.
     *
     * Фоновый health-check при генерации бьёт апстрим и при неудаче навсегда уводит прокси
     * в SUSPENDED + блокирует логин на гейтвее. Флаки-апстрим (особенно резидентский Mango)
     * может отвалиться по таймауту, хотя прокси живой → рабочий прокси мёртв у нас навсегда.
     * Здесь раз в 10 минут перепроверяем такие прокси: если снова отвечают — реактивируем и
     * заново регистрируем логин на гейтвее (снимает блок).
     *
     * Берём только by-GB gateway-типы (у них SUSPENDED бывает лишь от health-check) и только
     * при положительном балансе по тарифу (не реанимируем прокси юзеров без трафика).
     */
    @Cron(CronExpression.EVERY_10_MINUTES)
    async recoverSuspendedGatewayProxies() {
        const GATEWAY_GB_TYPES = ["RESIDENT_PREMIUM", "ISP_USA", "ISP_EU", "RESIDENTIAL_LITE", "MOBILE_GB", "IPV6_GB"];
        const balanceFieldByType: Record<string, string> = {
            RESIDENT_PREMIUM: "premiumTrafficLeft",
            ISP_USA: "ispUsaTrafficLeft",
            ISP_EU: "ispEuTrafficLeft",
            RESIDENTIAL_LITE: "residentialLiteTrafficLeft",
            MOBILE_GB: "mobileGbTrafficLeft",
            IPV6_GB: "ipv6GbTrafficLeft",
        };

        const suspended = await this.prisma.proxy.findMany({
            where: {
                status: "SUSPENDED" as any,
                type: { in: GATEWAY_GB_TYPES as any },
                serverHost: { not: null },
                userPort: { not: null },
                userLogin: { not: null },
                userPassword: { not: null },
            } as any,
            take: 50,
            orderBy: { updatedAt: "desc" },
        });
        if (!suspended.length) return 0;

        const tokenByHost = new Map<string, string | null>();
        const getToken = async (host: string): Promise<string | null> => {
            if (!tokenByHost.has(host)) {
                const srv = await this.prisma.proxyServer.findFirst({ where: { host } });
                tokenByHost.set(host, srv?.token ?? null);
            }
            return tokenByHost.get(host) ?? null;
        };
        const userById = new Map<string, any>();
        const getUser = async (uid: string) => {
            if (!userById.has(uid)) userById.set(uid, await this.prisma.user.findUnique({ where: { id: uid } }));
            return userById.get(uid);
        };

        let recovered = 0;
        for (const p of suspended) {
            try {
                const field = balanceFieldByType[p.type as string];
                const u = await getUser(p.userId!);
                if (!u || !field || BigInt((u as any)[field] || "0") <= 0n) continue; // нет баланса — не реанимируем

                // Mango-резидент: сперва разблокируем суб-аккаунт (flow на стороне Mango),
                // иначе апстрим 403 и восстановление не пройдёт проверку.
                if (p.type === "RESIDENT_PREMIUM") {
                    await this.mangoProxyProvider.ensureMangoFlow((u as any).premiumUsername);
                }

                const token = await getToken(p.serverHost!);
                if (!token) continue;

                // Регистрируем логин обратно (ActivatePort снимает Blocked), затем проверяем через гейтвей.
                await this.proxyServerService.activatePortOnServer(
                    p.serverHost!, p.userPort!, p.userLogin!, p.userPassword!,
                    p.host, p.port, p.username, p.password, token,
                );
                const ok = await this.proxyService.verifyIssuedProxyWorks(p.serverHost!, p.userPort!, p.userLogin!, p.userPassword!, 3);
                if (!ok) {
                    // не ожил — снова блокируем логин, оставляем SUSPENDED
                    await this.proxyServerService.blockLoginOnServer(p.serverHost!, p.userLogin!, token).catch(() => {});
                    continue;
                }
                await this.prisma.proxy.update({
                    where: { id: p.id },
                    data: { status: "ACTIVE" as any, lastActivityAt: new Date() },
                });
                recovered++;
                console.log(`[PACKAGE SERVICE] Прокси ${p.id} восстановлен из SUSPENDED (снова отвечает)`);
            } catch (e: any) {
                console.error(`[PACKAGE SERVICE] recover ${p.id} упал: ${e?.message || e}`);
            }
        }
        if (recovered > 0) console.log(`[PACKAGE SERVICE] Восстановлено ${recovered} прокси из SUSPENDED`);
        return recovered;
    }

    /**
     * Приостанавливает мобильные прокси после истечения rentTime
     * Вызывается каждый час
     */
    @Cron(CronExpression.EVERY_HOUR)
    async suspendExpiredMobileProxies() {
        // Находим все UserPackage типа MOBILE с rentTime
        const mobileUserPackages = await this.prisma.userPackage.findMany({
            where: {
                type: "MOBILE" as any,
                rentTime: {
                    not: null,
                } as any,
            },
            include: {
                proxies: true,
            },
        });

        let suspendedCount = 0;

        for (const userPackage of mobileUserPackages) {
            const pkg = userPackage as any;
            if (!pkg.rentTime || !pkg.createdAt) {
                continue;
            }

            // Вычисляем время истечения аренды
            const expirationTime = new Date(pkg.createdAt.getTime() + pkg.rentTime * 1000);
            const now = new Date();

            // Если время аренды истекло, приостанавливаем все прокси
            if (now >= expirationTime) {
                const proxies = (pkg.proxies || []) as any[];
                const activeProxies = proxies.filter(
                    (proxy) => proxy.status === ProxyStatus.ACTIVE
                );

                if (activeProxies.length > 0) {
                    await this.prisma.proxy.updateMany({
                        where: {
                            id: {
                                in: activeProxies.map((p) => p.id),
                            },
                        },
                        data: {
                            status: ProxyStatus.SUSPENDED,
                        },
                    });

                    suspendedCount += activeProxies.length;
                    console.log(
                        `[PACKAGE SERVICE] Приостановлено ${activeProxies.length} мобильных прокси для UserPackage ${pkg.id} (время аренды истекло)`
                    );
                }
            }
        }

        if (suspendedCount > 0) {
            console.log(`[PACKAGE SERVICE] Приостановлено ${suspendedCount} мобильных прокси с истекшим временем аренды`);
        }

        return suspendedCount;
    }

    /**
     * Удаляет мобильные пакеты через 5 дней после истечения rentTime
     * Вызывается каждый день
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async deleteExpiredMobilePackages() {
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

        // Находим все UserPackage типа MOBILE с rentTime, которые были созданы более 5 дней назад
        const expiredUserPackages = await this.prisma.userPackage.findMany({
            where: {
                type: "MOBILE" as any,
                rentTime: {
                    not: null,
                } as any,
                createdAt: {
                    lt: fiveDaysAgo,
                },
            },
            include: {
                proxies: true,
            },
        });

        let deletedCount = 0;

        for (const userPackage of expiredUserPackages) {
            const pkg = userPackage as any;
            if (!pkg.rentTime || !pkg.createdAt) {
                continue;
            }

            // Вычисляем время истечения аренды
            const expirationTime = new Date(pkg.createdAt.getTime() + pkg.rentTime * 1000);
            const fiveDaysAfterExpiration = new Date(expirationTime.getTime() + 5 * 24 * 60 * 60 * 1000);
            const now = new Date();

            // Если прошло 5 дней после истечения аренды, удаляем пакет
            if (now >= fiveDaysAfterExpiration) {
                try {
                    const proxies = (pkg.proxies || []) as any[];
                    // Удаляем все прокси
                    for (const proxy of proxies) {
                        if (proxy.userPort && proxy.serverHost) {
                            try {
                                const server = await this.prisma.proxyServer.findFirst({
                                    where: { host: proxy.serverHost },
                                    select: { token: true },
                                });

                                if (server?.token) {
                                    await this.proxyServerService.releasePortOnServer(
                                        proxy.serverHost,
                                        proxy.userPort,
                                        server.token
                                    );
                                }
                            } catch (error: any) {
                                console.error(
                                    `[PACKAGE SERVICE] Ошибка при освобождении порта ${proxy.userPort}: ${error.message}`
                                );
                            }
                        }

                        await this.prisma.proxy.delete({
                            where: { id: proxy.id },
                        });
                    }

                    // Удаляем UserPackage
                    await this.prisma.userPackage.delete({
                        where: { id: pkg.id },
                    });

                    // Удаляем связанные Package типа MOBILE (если есть)
                    await this.prisma.package.deleteMany({
                        where: {
                            type: "MOBILE",
                            createdAt: {
                                gte: new Date(pkg.createdAt.getTime() - 60000), // ±1 минута
                                lte: new Date(pkg.createdAt.getTime() + 60000),
                            },
                        },
                    });

                    deletedCount++;
                    console.log(
                        `[PACKAGE SERVICE] Удален мобильный пакет ${pkg.id} с ${proxies.length} прокси (прошло 5 дней после истечения аренды)`
                    );
                } catch (error: any) {
                    console.error(`[PACKAGE SERVICE] Ошибка при удалении мобильного пакета ${pkg.id}: ${error.message}`);
                }
            }
        }

        if (deletedCount > 0) {
            console.log(`[PACKAGE SERVICE] Удалено ${deletedCount} мобильных пакетов после 5 дней бездействия`);
        }

        return deletedCount;
    }

    async refreshAllPackageProxies(packageId: string, userId: string) {
        // Ищем UserPackage по packageId
        const userPackage = await this.prisma.userPackage.findUnique({
            where: {
                id: packageId,
            },
        });

        if (!userPackage) {
            throw new NotFoundException("errors.package_not_found");
        }

        // Проверяем, что пакет принадлежит пользователю
        if (userPackage.userId !== userId) {
            throw new BadRequestException("Пакет не принадлежит этому пользователю");
        }

        const packageType = (userPackage as any).type;

        // Проверяем, что это MOBILE пакет
        if (packageType !== "MOBILE") {
            throw new BadRequestException("Ротация IP доступна только для MOBILE пакетов");
        }

        // Получаем все прокси этого пакета
        const proxies = await this.prisma.proxy.findMany({
            where: {
                userPackageId: packageId as any,
                type: "MOBILE",
            },
        });

        if (proxies.length === 0) {
            throw new BadRequestException("В пакете нет прокси для ротации");
        }

        this.logger.log("SYSTEM", `Начало ротации IP для пакета ${packageId}: найдено ${proxies.length} прокси`, userId);

        const results: Array<{ proxyId: string; success: boolean; ip?: string; error?: string }> = [];
        let successCount = 0;
        let errorCount = 0;

        // Ротируем каждый прокси
        for (const proxy of proxies) {
            try {
                const refreshResult = await this.proxyService.refreshProxy(proxy.id);
                results.push({
                    proxyId: proxy.id,
                    success: true,
                    ip: refreshResult.ip,
                });
                successCount++;
                this.logger.log("SYSTEM", `Успешная ротация IP для прокси ${proxy.id}: новый IP ${refreshResult.ip}`, userId);
            } catch (error: any) {
                results.push({
                    proxyId: proxy.id,
                    success: false,
                    error: error.message || "Неизвестная ошибка",
                });
                errorCount++;
                this.logger.error(`Ошибка при ротации IP для прокси ${proxy.id}: ${error.message || String(error)}`, userId, error);
            }
        }

        this.logger.log("SYSTEM", `Завершена ротация IP для пакета ${packageId}: успешно ${successCount}, ошибок ${errorCount}`, userId);

        return {
            success: true,
            total: proxies.length,
            successCount,
            errorCount,
            results,
        };
    }
}
