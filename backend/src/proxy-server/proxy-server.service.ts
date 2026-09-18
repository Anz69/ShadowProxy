import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProxyServerStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PROXY_SERVER_PORT } from '../shared/utils/hash-credentials';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProxyServerService {
    private readonly logger = new Logger(ProxyServerService.name);
    private readonly serverHealth = new Map<string, { healthy: boolean; expiresAt: number }>();
    private readonly healthCacheMs = 5000;

    constructor(
        private prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Публичный адрес, который видит клиент. Внутренний IP остаётся в БД и
     * используется control-plane для синхронизации агента. После привязки DNS
     * достаточно выставить PROXY_PUBLIC_HOST без миграции существующих записей.
     */
    getPublicHost(internalHost: string): string {
        const configured = this.configService.get<string>('PROXY_PUBLIC_HOST', '').trim();
        if (!configured) return internalHost;
        return configured.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').split(':')[0] || internalHost;
    }

    // Получить все серверы с динамическим подсчётом загрузки
    async getAllServers() {
        const servers = await this.prisma.proxyServer.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Добавляем currentLoad динамически
        return await Promise.all(
            servers.map(async server => {
                const proxyCount = await this.prisma.proxy.count({
                    where: { serverHost: server.host },
                });
                return {
                    ...server,
                    currentLoad: proxyCount,
                    _count: {
                        ports: proxyCount,
                    },
                };
            })
        );
    }

    // Получить сервер по ID
    async getServerById(id: string) {
        const server = await this.prisma.proxyServer.findUnique({
            where: { id },
        });

        if (!server) {
            throw new NotFoundException('Сервер не найден');
        }

        return server;
    }

    // Создать сервер
    async createServer(data: {
        host: string;
    }) {
        // Проверка уникальности IP
        const existing = await this.prisma.proxyServer.findFirst({
            where: { host: data.host },
        });

        if (existing) {
            throw new BadRequestException('Сервер с таким IP уже существует');
        }

        return this.prisma.proxyServer.create({
            data: {
                host: data.host,
                status: ProxyServerStatus.ACTIVE,
            },
        });
    }

    // Обновить сервер
    async updateServer(
        id: string,
        data: {
            host?: string;
            status?: ProxyServerStatus;
        },
    ) {
        const server = await this.prisma.proxyServer.findUnique({
            where: { id },
        });

        if (!server) {
            throw new NotFoundException('Сервер не найден');
        }

        // Проверка уникальности IP при изменении
        if (data.host && data.host !== server.host) {
            const existing = await this.prisma.proxyServer.findFirst({
                where: { host: data.host },
            });

            if (existing) {
                throw new BadRequestException('Сервер с таким IP уже существует');
            }
        }

        return this.prisma.proxyServer.update({
            where: { id },
            data,
        });
    }

    // Удалить сервер
    async deleteServer(id: string) {
        const server = await this.prisma.proxyServer.findUnique({
            where: { id },
        });

        if (!server) {
            throw new NotFoundException('Сервер не найден');
        }

        const proxyCount = await this.prisma.proxy.count({
            where: { serverHost: server.host },
        });

        if (proxyCount > 0) {
            throw new BadRequestException(
                `Нельзя удалить сервер с активными прокси (${proxyCount} шт.)`,
            );
        }

        await this.prisma.proxyServer.delete({
            where: { id },
        });

        return { success: true };
    }

    // Активировать/деактивировать сервер
    async toggleServerStatus(id: string) {
        const server = await this.prisma.proxyServer.findUnique({
            where: { id },
        });

        if (!server) {
            throw new NotFoundException('Сервер не найден');
        }

        const newStatus =
            server.status === ProxyServerStatus.ACTIVE
                ? ProxyServerStatus.OFFLINE
                : ProxyServerStatus.ACTIVE;

        return this.prisma.proxyServer.update({
            where: { id },
            data: {
                status: newStatus,
            },
        });
    }

    // Сгенерировать токен для сервера
    async generateServerToken(serverId: string) {
        console.log(`[ProxyServerService] generateServerToken: начало генерации токена для сервера ${serverId}`);
        
        const server = await this.prisma.proxyServer.findUnique({
            where: { id: serverId },
        });

        if (!server) {
            console.log(`[ProxyServerService] generateServerToken: сервер ${serverId} не найден`);
            throw new NotFoundException('Сервер не найден');
        }

        console.log(`[ProxyServerService] generateServerToken: сервер найден - ${server.host}`);

        // Генерируем новый токен
        const token = randomUUID();
        console.log(`[ProxyServerService] generateServerToken: сгенерирован токен ${token}`);

        // Сохраняем токен в базу данных
        try {
            const updated = await this.prisma.proxyServer.update({
                where: { id: serverId },
                data: { token },
            });
            console.log(`[ProxyServerService] generateServerToken: токен сохранен в БД для сервера ${updated.host}, токен: ${updated.token}`);
        } catch (error) {
            console.error(`[ProxyServerService] generateServerToken: ОШИБКА при сохранении токена:`, error);
            throw error;
        }

        // Проверяем что токен действительно сохранился
        const verify = await this.prisma.proxyServer.findUnique({
            where: { id: serverId },
            select: { token: true, host: true },
        });
        console.log(`[ProxyServerService] generateServerToken: проверка сохранения - токен в БД: ${verify?.token || 'НЕТ'}`);

        return {
            token,
            serverId: server.host, // Используем IP как serverId
        };
    }

    // Регистрация прокси-ноды
    async registerProxyNode(serverId: string) {
        // serverId - это IP адрес сервера
        console.log(`[ProxyServerService] registerProxyNode: ищем сервер с IP ${serverId}`);
        
        const server = await this.prisma.proxyServer.findFirst({
            where: {
                host: serverId,
                status: ProxyServerStatus.ACTIVE
            }
        });

        console.log(`[ProxyServerService] registerProxyNode: сервер найден:`, server ? { id: server.id, host: server.host, hasToken: !!server.token } : 'не найден');

        if (!server) {
            throw new NotFoundException(`Сервер с IP ${serverId} не найден или неактивен. Проверьте админку.`);
        }

        if (!server.token) {
            console.log(`[ProxyServerService] registerProxyNode: у сервера ${serverId} нет токена. Токен должен быть сгенерирован в админке.`);
            throw new BadRequestException('Токен для сервера не сгенерирован. Обратитесь к администратору.');
        }

        console.log(`[ProxyServerService] registerProxyNode: успешная регистрация сервера ${serverId}`);

        setImmediate(() => {
            this.syncAllActivePortsToServer(server.host, server.token!).catch((e) => {
                console.warn(`[ProxyServerService] syncAllActivePortsToServer(${server.host}) failed:`, e?.message || e);
            });
        });

        return {
            success: true,
            token: server.token,
            server_id: server.host,
            message: 'Сервер успешно зарегистрирован'
        };
    }

    async syncAllActivePortsToServer(serverHost: string, token: string): Promise<{ success: number; failed: number }> {
        const activeProxies = await this.prisma.proxy.findMany({
            where: {
                serverHost,
                status: 'ACTIVE',
                userPort: { not: null },
                userLogin: { not: null },
                userPassword: { not: null },
            } as any,
        });

        if (activeProxies.length === 0) {
            console.log(`[ProxyServerService] syncAllActivePortsToServer(${serverHost}): нет ACTIVE прокси для синка`);
            return { success: 0, failed: 0 };
        }

        const ports = activeProxies.map((proxy: any) => ({
            port: proxy.userPort!,
            login: proxy.userLogin!,
            password: proxy.userPassword!,
            proxy_host: proxy.host,
            proxy_port: proxy.port,
            proxy_username: proxy.username,
            proxy_password: proxy.password,
        }));

        try {
            console.log(`[ProxyServerService] syncAllActivePortsToServer(${serverHost}): отправка ${ports.length} портов`);
            await axios.post(
                `http://${serverHost}:808/add-ports`,
                { ports },
                { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: 30000 },
            );
            console.log(`[ProxyServerService] syncAllActivePortsToServer(${serverHost}): OK (${ports.length})`);
            return { success: ports.length, failed: 0 };
        } catch (e: any) {
            console.warn(`[ProxyServerService] syncAllActivePortsToServer(${serverHost}): batch failed (${e?.response?.status || e?.code}). Fallback не реализован — достаточно batch.`);
            return { success: 0, failed: ports.length };
        }
    }

    private rememberServerHealth(host: string, healthy: boolean): void {
        this.serverHealth.set(host, {
            healthy,
            expiresAt: Date.now() + this.healthCacheMs,
        });
    }

    private async isServerHealthy(server: { host: string; token: string | null }): Promise<boolean> {
        if (!server.token) return false;

        const cached = this.serverHealth.get(server.host);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.healthy;
        }

        try {
            const response = await axios.get(`http://${server.host}:808/health`, {
                headers: { Authorization: `Bearer ${server.token}` },
                timeout: 2500,
            });
            const healthy = response.status === 200 && response.data?.status === 'ok';
            this.rememberServerHealth(server.host, healthy);
            return healthy;
        } catch (error: any) {
            this.rememberServerHealth(server.host, false);
            this.logger.warn(
                `[ProxyServerService] Gateway ${server.host} недоступен: ${error?.code || error?.message || 'health-check failed'}`,
            );
            return false;
        }
    }

    /** V2: выбрать живой ACTIVE-сервер с наименьшей загрузкой (порт 10000 общий) */
    async getServerForProxy(): Promise<{ serverHost: string }> {
        const servers = await this.prisma.proxyServer.findMany({
            where: {
                status: ProxyServerStatus.ACTIVE,
                token: { not: null },
            },
        });

        if (servers.length === 0) {
            throw new ServiceUnavailableException('Нет настроенных активных прокси-серверов');
        }

        const health = await Promise.all(servers.map((server) => this.isServerHealthy(server)));
        const healthyServers = servers.filter((_, index) => health[index]);

        if (healthyServers.length === 0) {
            throw new ServiceUnavailableException(
                'Прокси-серверы временно недоступны. Повторите попытку через несколько секунд.',
            );
        }

        const serversWithLoad = await Promise.all(
            healthyServers.map(async (server) => {
                const count = await this.prisma.proxy.count({
                    where: { serverHost: server.host },
                });
                return { server, load: count };
            }),
        );

        serversWithLoad.sort((a, b) => a.load - b.load);
        const { server } = serversWithLoad[0];
        console.log(`[ProxyServerService] getServerForProxy: сервер ${server.host}, загрузка ${serversWithLoad[0].load}`);
        return { serverHost: server.host };
    }

    /** @deprecated V1 — оставлено для совместимости, используйте getServerForProxy для V2 */
    async allocatePort(): Promise<{ serverHost: string; port: number }> {
        const { serverHost } = await this.getServerForProxy();
        return { serverHost, port: PROXY_SERVER_PORT };
    }

    /** V2: заблокировать логин (закрыть соединения) */
    async blockLoginOnServer(serverHost: string, login: string, authToken: string): Promise<void> {
        try {
            await axios.post(
                `http://${serverHost}:808/block-login`,
                { login },
                {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 5000,
                },
            );
            this.logger.log(`[ProxyServerService] Логин ${login} заблокирован на сервере ${serverHost}`);
        } catch (error: any) {
            this.logger.warn(`[ProxyServerService] Не удалось заблокировать логин ${login} на ${serverHost}: ${error.message}`);
        }
    }

    /** @deprecated V1 — для V2 используйте blockLoginOnServer */
    async releasePortOnServer(serverHost: string, port: number, authToken: string): Promise<void> {
        const maxRetries = 10; // Максимум 10 попыток (50 секунд)
        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[PROXY SERVER REQUEST] ${serverHost} -> STOP port ${port} (попытка ${attempt}/${maxRetries})`);
                
                const response = await axios.post(
                    `http://${serverHost}:808/stop`,
                    { port },
                    {
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 5000,
                    },
                );
                
                console.log(`[PROXY SERVER RESPONSE] ${serverHost} <- STOP port ${port}:`, response.data);
                this.logger.log(`[ProxyServerService] Порт ${port} успешно освобожден на сервере ${serverHost} (попытка ${attempt})`);
                return; // Успешно - выходим
            } catch (error: any) {
                lastError = error;
                console.error(`[PROXY SERVER ERROR] ${serverHost} -> STOP port ${port} (попытка ${attempt}/${maxRetries}):`, error.message);
                
                if (attempt < maxRetries) {
                    console.log(`[PROXY SERVER RETRY] Повтор через 5 секунд...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    this.logger.error(`[ProxyServerService] Ошибка при освобождении порта ${port} на сервере ${serverHost} после ${maxRetries} попыток: ${error.message}`);
                }
            }
        }

        // Не пробрасываем ошибку, чтобы не блокировать удаление портов из БД
        // Но логируем, что не удалось освободить порт
        this.logger.warn(`[ProxyServerService] Не удалось освободить порт ${port} на сервере ${serverHost} после ${maxRetries} попыток, но продолжаем удаление из БД`);
    }

    // Отправить команду ADD-PORT на прокси-сервер для активации порта
    async activatePortOnServer(
        serverHost: string,
        port: number,
        login: string,
        password: string,
        proxyHost: string,
        proxyPort: number,
        proxyUsername: string,
        proxyPassword: string,
        authToken: string
    ): Promise<void> {
        const maxRetries = 2;
        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.log(`[ProxyServerService] ADD-PORT ${serverHost}:${port} (попытка ${attempt}/${maxRetries})`, {
                    port,
                    login,
                    proxyHost,
                    proxyPort,
                    proxyUsername,
                });

                const response = await axios.post(
                    `http://${serverHost}:808/add-port`,
                    {
                        user_id: "user", // Заглушка, можно передать реальный user_id
                        port,
                        login,
                        password,
                        proxy_host: proxyHost,
                        proxy_port: proxyPort,
                        proxy_username: proxyUsername,
                        proxy_password: proxyPassword
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 3000,
                    },
                );

                this.rememberServerHealth(serverHost, true);
                this.logger.log(`[ProxyServerService] Порт ${port} успешно активирован на сервере ${serverHost} (попытка ${attempt})`);
                return; // Успешно - выходим
            } catch (error: any) {
                lastError = error;
                this.rememberServerHealth(serverHost, false);
                this.logger.warn(
                    `[ProxyServerService] ADD-PORT ${serverHost}:${port} не выполнен (попытка ${attempt}/${maxRetries}): ${error?.code || error?.message}`,
                );

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    this.logger.error(`[ProxyServerService] Ошибка при активации порта ${port} на сервере ${serverHost} после ${maxRetries} попыток: ${error.message}`);
                }
            }
        }

        // В V2 порт 10000 общий. STOP здесь удалил бы доступ остальных пользователей,
        // поэтому при ошибке активации только возвращаем безопасную понятную ошибку.
        throw new BadGatewayException(
            `Gateway ${serverHost} не подтвердил активацию прокси: ${lastError?.code || 'upstream unavailable'}`,
        );
    }

    // Cron задача: удаление неактивных портов (>30 дней) для всех типов прокси
    @Cron(CronExpression.EVERY_HOUR)
    async cleanupInactivePorts() {
        this.logger.log('[ProxyServerService] Запуск очистки неактивных портов для всех типов прокси...');
        
        // Порты, неактивные более 30 дней
        const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const inactiveProxies = await this.prisma.proxy.findMany({
            where: {
                lastActivityAt: { lt: cutoffTime },
                serverHost: { not: null },
            },
            select: {
                id: true,
                serverHost: true,
                userLogin: true,
                type: true,
            },
        });

        if (inactiveProxies.length === 0) {
            this.logger.log('[ProxyServerService] Неактивных прокси не найдено');
            return;
        }

        this.logger.log(`[ProxyServerService] Найдено ${inactiveProxies.length} неактивных прокси для удаления`);

        for (const proxy of inactiveProxies) {
            try {
                const server = await this.prisma.proxyServer.findFirst({
                    where: { host: proxy.serverHost! },
                    select: { token: true },
                });

                if (server?.token && proxy.userLogin) {
                    await this.blockLoginOnServer(proxy.serverHost!, proxy.userLogin, server.token);
                }

                await this.prisma.proxy.delete({ where: { id: proxy.id } });
                this.logger.log(`[ProxyServerService] Прокси ${proxy.id} (тип ${proxy.type}) удален из БД`);
            } catch (error: any) {
                this.logger.error(`[ProxyServerService] Ошибка при удалении прокси ${proxy.userLogin ?? proxy.id} (тип: ${proxy.type}): ${error.message}`);
            }
        }

        this.logger.log(`[ProxyServerService] Очистка неактивных прокси завершена. Удалено: ${inactiveProxies.length} прокси`);
    }

    /**
     * Обработчик события реактивации прокси (асинхронный, вне транзакции платежа)
     */
    @OnEvent("proxy.reactivate")
    async handleProxyReactivate({ userId, proxyType }: { userId: string; proxyType: string }) {
        this.logger.log(`[ProxyServerService] Получено событие реактивации: userId=${userId}, type=${proxyType}`);
        
        // Запускаем в отдельном процессе, не блокируя
        setImmediate(async () => {
            try {
                await this.reactivateUserProxies(userId, proxyType);
            } catch (error: any) {
                this.logger.error(`[ProxyServerService] Ошибка асинхронной реактивации: ${error.message}`);
            }
        });
    }

    /**
     * Реактивация всех SUSPENDED прокси пользователя определённого типа на прокси-серверах.
     * Оптимизировано: группировка по серверам и batch-запросы.
     */
    async reactivateUserProxies(userId: string, proxyType: string): Promise<{ success: number; failed: number }> {
        this.logger.log(`[ProxyServerService] Реактивация прокси для пользователя ${userId}, тип: ${proxyType}`);

        const suspendedProxies = await this.prisma.proxy.findMany({
            where: {
                userId,
                type: proxyType as any,
                status: 'SUSPENDED',
                serverHost: { not: null },
                userPort: { not: null },
                userLogin: { not: null },
                userPassword: { not: null },
            },
        });

        if (suspendedProxies.length === 0) {
            this.logger.log(`[ProxyServerService] Нет SUSPENDED прокси для реактивации (userId: ${userId}, type: ${proxyType})`);
            return { success: 0, failed: 0 };
        }

        this.logger.log(`[ProxyServerService] Найдено ${suspendedProxies.length} SUSPENDED прокси для реактивации`);

        // Группируем прокси по серверам
        const proxyByServer = new Map<string, typeof suspendedProxies>();
        for (const proxy of suspendedProxies) {
            const serverHost = proxy.serverHost!;
            if (!proxyByServer.has(serverHost)) {
                proxyByServer.set(serverHost, []);
            }
            proxyByServer.get(serverHost)!.push(proxy);
        }

        // Получаем токены всех серверов одним запросом
        const serverHosts = Array.from(proxyByServer.keys());
        const servers = await this.prisma.proxyServer.findMany({
            where: { host: { in: serverHosts } },
            select: { host: true, token: true },
        });
        const serverTokens = new Map(servers.map(s => [s.host, s.token]));

        let success = 0;
        let failed = 0;
        const proxyIdsToActivate: string[] = [];

        // Обрабатываем каждый сервер параллельно
        const serverPromises = Array.from(proxyByServer.entries()).map(async ([serverHost, proxies]) => {
            const token = serverTokens.get(serverHost);
            if (!token) {
                this.logger.warn(`[ProxyServerService] Сервер ${serverHost} не имеет токена, пропускаем ${proxies.length} прокси`);
                failed += proxies.length;
                return;
            }

            // Формируем batch-запрос с массивом портов
            const ports = proxies.map(proxy => ({
                port: proxy.userPort!,
                login: proxy.userLogin!,
                password: proxy.userPassword!,
                proxy_host: proxy.host,
                proxy_port: proxy.port,
                proxy_username: proxy.username,
                proxy_password: proxy.password,
            }));

            try {
                this.logger.log(`[ProxyServerService] Отправка batch-запроса на ${serverHost}: ${ports.length} портов`);
                
                const response = await axios.post(
                    `http://${serverHost}:808/add-ports`,
                    { ports },
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 30000,
                    },
                );

                this.logger.log(`[ProxyServerService] Batch-ответ от ${serverHost}: ${JSON.stringify(response.data)}`);
                
                // Все прокси этого сервера успешно активированы
                for (const proxy of proxies) {
                    proxyIdsToActivate.push(proxy.id);
                    success++;
                }
            } catch (batchError: any) {
                // Если batch не поддерживается, пробуем по одному
                if (batchError.response?.status === 404 || batchError.code === 'ECONNREFUSED') {
                    this.logger.warn(`[ProxyServerService] Batch-запрос не поддерживается на ${serverHost}, используем поштучную активацию`);
                    
                    for (const proxy of proxies) {
                        try {
                            await this.activatePortOnServer(
                                serverHost,
                                proxy.userPort!,
                                proxy.userLogin!,
                                proxy.userPassword!,
                                proxy.host,
                                proxy.port,
                                proxy.username,
                                proxy.password,
                                token
                            );
                            proxyIdsToActivate.push(proxy.id);
                            success++;
                        } catch (error: any) {
                            this.logger.error(`[ProxyServerService] Ошибка активации прокси ${proxy.id}: ${error.message}`);
                            failed++;
                        }
                    }
                } else {
                    this.logger.error(`[ProxyServerService] Ошибка batch-запроса на ${serverHost}: ${batchError.message}`);
                    failed += proxies.length;
                }
            }
        });

        // Ждём завершения всех серверов
        await Promise.all(serverPromises);

        // Обновляем статус всех успешных прокси одним запросом
        if (proxyIdsToActivate.length > 0) {
            await this.prisma.proxy.updateMany({
                where: { id: { in: proxyIdsToActivate } },
                data: { 
                    status: 'ACTIVE',
                    lastActivityAt: new Date(),
                },
            });
            this.logger.log(`[ProxyServerService] Обновлён статус ${proxyIdsToActivate.length} прокси в БД`);
        }

        this.logger.log(`[ProxyServerService] Реактивация завершена. Успешно: ${success}, Ошибок: ${failed}`);
        return { success, failed };
    }
}
