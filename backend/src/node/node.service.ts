import { forwardRef, Inject, Injectable, InternalServerErrorException, OnModuleInit } from "@nestjs/common";
import { Socket } from "socket.io";
import { InitializeDto } from "./dtos/initialize.dto";
import { ProxyType } from "@prisma/client";
import { ServerRegion } from "../proxy/types/server-region.type";
import { v4 } from "uuid";
import * as crypto from "crypto";
import axios from "axios";
import { ConfigService } from "@nestjs/config";
import { BaseDto } from "./dtos/base.dto";
import { ActivatedReportDto } from "./dtos/activated-report.dto";
import { PrismaService } from "../prisma/prisma.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { regionToServer } from "../shared/utils/region-to-server";
import { UserService } from "../user/user.service";
import { LoggerService } from "../logger/logger.service";
import { sleep } from "../shared/utils/sleep";
import { isDev } from "../shared/utils/is-dev";
import { splitByChunks } from "../shared/utils/split-by-chunks";

type CreateProxyDto = { id: string; connectionString: string }[];
type CreatedProxy = { id: string; host: string; port: number; username: string; password: string };

@Injectable()
export class NodeService implements OnModuleInit {
    private nodeClients: Map<keyof ServerRegion, Socket> = new Map();
    private activeSyncs: Map<string, boolean> = new Map(); // Отслеживание активных синхронизаций по серверу

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService,
    ) {}

    async onModuleInit() {
        // Синхронизируем активные порты со всеми подключенными серверами при старте
        setTimeout(async () => {
            console.log('[PORT SYNC] Инициация синхронизации активных портов при запуске backend...');
            await this.syncActivePortsWithServers();
        }, 5000); // Ждем 5 секунд после старта, чтобы все сервисы инициализировались
    }

    async initializeNode(dto: InitializeDto, socket: Socket) {
        const ok = this.verifyPayload(dto, dto.nodeLocation);
        if (!ok) {
            socket.disconnect();
            return;
        }

        const prev = this.nodeClients.get(dto.nodeLocation);
        if (prev && prev.id !== socket.id) prev.disconnect(true);

        this.nodeClients.set(dto.nodeLocation, socket);
        console.log("NODE CONNECTED:", dto.nodeLocation);

        socket.once("disconnect", () => {
            const current = this.nodeClients.get(dto.nodeLocation);
            if (current && current.id === socket.id) this.nodeClients.delete(dto.nodeLocation);
        });

        const allProxies = await this.prisma.proxy.findMany({
            where: {
                type: ProxyType.IPV6_GB,
            },
        });
        const takenPorts = allProxies.filter((el) => !dto.busyPorts.map((port) => port.port).includes(el.port)).map((el) => el.port.toString());
        const expiredProxies = dto.busyPorts.filter((el) => !allProxies.map((proxy) => proxy.id).includes(el.id));
        this.nodeClients.set(dto.nodeLocation, socket);
        this.emit(
            "delete",
            {
                ports: expiredProxies.map((el) => el.id),
                takenPorts,
            },
            dto.nodeLocation,
        );
    }

    async getPortsAvailability(quantity: number, serverRegion: keyof ServerRegion) {
        const availability = await this.emitWithResponse<{ available: boolean }>(
            "get_availability",
            {
                quantity,
            },
            serverRegion,
        );
        return availability.available;
    }

    async createProxy(proxies: CreateProxyDto, serverRegion: keyof ServerRegion) {
        const createdProxies = await this.emitWithResponse<{
            proxies: CreatedProxy[];
        }>(
            "create_proxy",
            {
                proxies,
            },
            serverRegion,
        );
        const verifyResult = this.verifyPayload(createdProxies, serverRegion);
        if (!verifyResult) {
            throw new InternalServerErrorException("errors.no_such_server");
        }
        return createdProxies.proxies;
    }

    deleteProxies(ports: string[], serverRegion: keyof ServerRegion) {
        // Разделяем порты на батчи по 50 штук для избежания перегрузки
        const batches: string[][] = [];
        for (let i = 0; i < ports.length; i += 50) {
            batches.push(ports.slice(i, i + 50));
        }

        for (const batch of batches) {
            this.emit(
                "delete",
                {
                    ports: batch,
                },
                serverRegion,
            );
            // Небольшая задержка между батчами
            if (batches.length > 1) {
                setTimeout(() => {}, 100);
            }
        }
    }

    async deleteUserProxies(userId: string, serverRegion?: keyof ServerRegion) {
        const userProxies = await this.prisma.proxy.findMany({
            where: {
                userId,
                type: ProxyType.IPV6_GB,
                rentTime: {
                    not: null,
                },
            },
        });

        if (userProxies.length === 0) return;

        const regionsToProcess = serverRegion ? [serverRegion] : ["usa", "cis", "europe"];

        for (const region of regionsToProcess) {
            const regionProxies = userProxies.filter(proxy =>
                regionToServer(proxy.country) === region
            );

            if (regionProxies.length > 0) {
                console.log(`[USER PROXY CLEANUP] Deleting ${regionProxies.length} proxies for user ${userId} in region ${region}`);
                this.deleteProxies(
                    regionProxies.map(proxy => proxy.id),
                    region as keyof ServerRegion
                );
            }
        }
    }

    async modifyLocations(
        proxies: {
            id: string;
            location: string;
            oldLocation: string;
            host: string;
            connectionString: string;
        }[],
    ) {
        const usaProxies = proxies.filter((el) => regionToServer(el.oldLocation) === "usa");
        const europeProxies = proxies.filter((el) => regionToServer(el.oldLocation) === "europe");
        const cisProxies = proxies.filter((el) => regionToServer(el.oldLocation) === "cis");
        this.deleteProxies(
            usaProxies.map((el) => el.id),
            "usa",
        );
        if (!isDev(this.configService)) {
            this.deleteProxies(
                europeProxies.map((el) => el.id),
                "europe",
            );
            this.deleteProxies(
                cisProxies.map((el) => el.id),
                "cis",
            );
        }
        await sleep(3000);
        const newProxiesData: Record<keyof ServerRegion, CreateProxyDto> = {
            usa: [],
            europe: [],
            cis: [],
        };
        for (const proxy of proxies) {
            newProxiesData[regionToServer(proxy.location)].push({
                id: proxy.id,
                connectionString: proxy.connectionString,
            });
        }
        const res: CreatedProxy[] = [];
        for (const region in newProxiesData) {
            if (newProxiesData[region as keyof ServerRegion].length) {
                res.push(...(await this.createProxy(newProxiesData[region], region as keyof ServerRegion)));
            }
        }
        return res;
    }

    async processActivatedReport(dto: ActivatedReportDto, socket: Socket) {
        const ok = this.verifyPayload(dto, dto.nodeLocation);
        if (!ok) {
            socket.disconnect();
            return;
        }
        await this.prisma.$transaction(async (tx) => {
            const allProxies = await tx.proxy.findMany({
                where: {
                    type: ProxyType.IPV6_GB,
                    id: {
                        in: dto.activatedIds,
                    },
                    rentTime: null,
                },
            });
            for (const { userId, sub } of [
                ...new Set(
                    allProxies.map(({ userId, sub }) =>
                        JSON.stringify({
                            userId,
                            sub,
                        }),
                    ),
                ),
            ].map((item) => JSON.parse(item) as { userId: string; sub: string | null })) {
                if (sub) {
                    const used = allProxies.filter((el) => el.sub === sub).length;
                    await tx.subAccount.update({
                        where: {
                            id: sub,
                        },
                        data: {
                            ipLeft: {
                                decrement: used,
                            },
                        },
                    });
                } else {
                    const used = allProxies.filter((el) => el.userId === userId).length;
                    await tx.user.update({
                        where: {
                            id: userId,
                        },
                        data: {
                            ispIpLeft: {
                                decrement: used,
                            },
                        },
                    });
                    await this.logger.log("USAGE", `Пользователь ${userId} активировал ${used} IPV6_GB прокси`, userId, {
                        used,
                        type: "IPV6_GB",
                    });
                }
            }
            await tx.proxy.updateMany({
                where: {
                    id: {
                        in: dto.activatedIds,
                    },
                    rentTime: null,
                },
                data: {
                    rentTime: Number(this.configService.getOrThrow<number>("ISP_PROXY_LIFETIME")),
                },
            });
        });
    }

    getSocket(destination: keyof ServerRegion) {
        const socket = this.nodeClients.get(destination);
        if (!socket) {
            throw new InternalServerErrorException("errors.no_such_server");
        }
        return socket;
    }

    emit(event: string, payload: object, destination: keyof ServerRegion) {
        const fullPayload = {
            ...payload,
            ...this.signPayload(payload, destination),
        };
        console.log(`[NODE REQUEST] ${destination} -> ${event}:`, JSON.stringify(fullPayload, null, 2));
        this.getSocket(destination).emit(event, fullPayload);
    }

    async emitWithResponse<T>(event: string, payload: object, destination: keyof ServerRegion): Promise<T & BaseDto> {
        const correlationId = v4();
        console.log(`[NODE REQUEST] ${destination} -> ${event} (correlationId: ${correlationId}):`, JSON.stringify(payload, null, 2));
        this.emit(event, { ...payload, correlationId }, destination);
        return new Promise((resolve) => {
            this.getSocket(destination).once(correlationId, (data: T & BaseDto) => {
                console.log(`[NODE RESPONSE] ${destination} <- ${event} (correlationId: ${correlationId}):`, JSON.stringify(data, null, 2));
                resolve(data);
            });
        });
    }

    private signPayload(payload: object, to: keyof ServerRegion) {
        const body = JSON.stringify(payload);
        const timestamp = Date.now();
        return {
            signature: crypto
                .createHmac("sha256", this.configService.getOrThrow<string>(`${to.toUpperCase()}_NODE_SECRET`))
                .update(body + timestamp)
                .digest("hex"),
            timestamp,
        };
    }

    private verifyPayload(body: object & BaseDto, from: keyof ServerRegion): boolean {
        const { signature, timestamp, ...dto } = body;
        const now = Date.now();
        if (Math.abs(now - timestamp) > 10_000) return false;

        const expected = crypto
            .createHmac("sha256", this.configService.getOrThrow<string>(`${from.toUpperCase()}_NODE_SECRET`))
            .update(JSON.stringify(dto) + timestamp)
            .digest("hex");

        return expected === signature;
    }

    // Периодическая синхронизация отключена - синхронизация только при запуске
    // @Cron(CronExpression.EVERY_5_MINUTES)
    // async syncActivePortsPeriodically() {
    //     console.log('[PORT SYNC] Периодическая синхронизация активных портов...');
    //     await this.syncActivePortsWithServers();
    // }


    // Синхронизация активных портов со всеми подключенными прокси-серверами
    async syncActivePortsWithServers() {
        // Получаем ВСЕ активные (оплаченные, не истёкшие) прокси с выделенными портами и
        // клиентскими кредами. Реестр гейтвея in-memory и обнуляется при рестарте — если
        // фильтровать по недавней активности, простаивавший >24ч прокси не регистрируется
        // и получает 403 навсегда (catch-22: активности нет, потому что не в реестре).
        // Регистрируем по факту ACTIVE, а не по свежести трафика.
        const activePorts = await this.prisma.proxy.findMany({
            where: {
                status: 'ACTIVE',
                serverHost: { not: null },
                userPort: { not: null },
                userLogin: { not: null },
                userPassword: { not: null },
            } as any,
        });

        if (activePorts.length === 0) {
            console.log('[PORT SYNC] Нет активных портов - выполняем полную очистку');

            // Очищаем все серверы - отправляем пустые списки
            for (const serverHost of Object.keys(this.activeSyncs)) {
                if (this.activeSyncs.get(serverHost)) {
                    console.log(`[PORT SYNC] Синхронизация для сервера ${serverHost} уже активна, пропускаем`);
                    continue;
                }

                this.activeSyncs.set(serverHost, true);

                try {
                    await this.sendDirectHttpRequest(serverHost, "sync_active_ports", {
                        activePorts: [],
                        timestamp: Date.now(),
                    });
                    console.log(`[PORT SYNC] Отправлена очистка портов серверу ${serverHost}`);
                } catch (error: any) {
                    const errorMsg = error.response?.data?.message || error.message || 'Неизвестная ошибка';
                    console.error(`[PORT SYNC] Ошибка очистки сервера ${serverHost}: ${errorMsg}`);
                    setTimeout(() => {
                        console.log(`[PORT SYNC] Повторная попытка очистки сервера ${serverHost}`);
                        this.retrySyncServerPortsOnce(serverHost, []);
                    }, 30000);
                } finally {
                    this.activeSyncs.delete(serverHost);
                }
            }

            return;
        }

        console.log(`[PORT SYNC] Синхронизация ${activePorts.length} активных портов со всеми серверами`);

        // Группируем активные прокси по серверам
        const portsByServer: Record<string, any[]> = {};
        for (const proxy of activePorts) {
            const serverHost = proxy.serverHost!;
            if (!portsByServer[serverHost]) {
                portsByServer[serverHost] = [];
            }
            // Если прокси suspended - блокируем трафик (не добавляем в синхронизацию)
            if (proxy.status === 'SUSPENDED') {
                console.log(`[PORT SYNC] Прокси ${proxy.id}: статус suspended, блокируем трафик`);
                continue;
            }

            portsByServer[serverHost].push({
                port: proxy.userPort!,
                user_id: proxy.userId!,
                login: proxy.userLogin!,
                password: proxy.userPassword!,
                proxy_host: proxy.host,
                proxy_port: proxy.port,
                proxy_username: proxy.username,
                proxy_password: proxy.password,
            });

        }

        // Отправляем синхронизацию на каждый сервер (без параллельных запросов)
        for (const [serverHost, portNumbers] of Object.entries(portsByServer)) {
            // Проверяем, не идет ли уже синхронизация для этого сервера
            if (this.activeSyncs.get(serverHost)) {
                console.log(`[PORT SYNC] Синхронизация для сервера ${serverHost} уже активна, пропускаем`);
                continue;
            }

            this.activeSyncs.set(serverHost, true);

            try {
                await this.sendDirectHttpRequest(serverHost, "sync_active_ports", {
                    activePorts: portNumbers,
                    timestamp: Date.now(),
                });
                console.log(`[PORT SYNC] Успешно синхронизировано ${portNumbers.length} портов с сервером ${serverHost}`);
            } catch (error: any) {
                const errorMsg = error.response?.data?.message || error.message || 'Неизвестная ошибка';
                console.error(`[PORT SYNC] Ошибка синхронизации с сервером ${serverHost}: ${errorMsg}`);
                // Повторим через 30 секунд для этого сервера (только одну попытку)
                setTimeout(() => {
                    console.log(`[PORT SYNC] Повторная попытка синхронизации с сервером ${serverHost}`);
                    this.retrySyncServerPortsOnce(serverHost, portNumbers as any[]);
                }, 30000);
            } finally {
                this.activeSyncs.delete(serverHost);
            }
        }
    }

    // Отправка HTTP запроса напрямую на прокси-сервер
    private async sendDirectHttpRequest(serverHost: string, endpoint: string, payload: any): Promise<void> {
        const url = `http://${serverHost}:808/${endpoint}`;

        // Получаем токен для этого сервера
        const server = await this.prisma.proxyServer.findFirst({
            where: { host: serverHost },
        });

        if (!server?.token) {
            throw new Error(`Токен для сервера ${serverHost} не найден`);
        }

        console.log(`[DIRECT HTTP] Отправка запроса на ${url}`);

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${server.token}`,
            },
            timeout: 10000,
        });

        console.log(`[DIRECT HTTP] Ответ от ${serverHost}:`, response.data);
    }

    // Однократная повторная попытка синхронизации портов для конкретного сервера
    private async retrySyncServerPortsOnce(serverHost: string, portData: any[]) {
        // Проверяем, не идет ли уже синхронизация для этого сервера
        if (this.activeSyncs.get(serverHost)) {
            console.log(`[PORT SYNC] Синхронизация для сервера ${serverHost} уже активна, пропускаем повторную попытку`);
            return;
        }

        this.activeSyncs.set(serverHost, true);

        try {
            await this.sendDirectHttpRequest(serverHost, "sync_active_ports", {
                activePorts: portData,
                timestamp: Date.now(),
            });
            console.log(`[PORT SYNC] Успешная повторная синхронизация ${portData.length} портов с сервером ${serverHost}`);
        } catch (error) {
            console.error(`[PORT SYNC] Повторная синхронизация с сервером ${serverHost} также неудачна:`, error.message);
            console.log(`[PORT SYNC] Прекращаем попытки синхронизации с сервером ${serverHost}`);
        } finally {
            this.activeSyncs.delete(serverHost);
        }
    }

    // Метод для принудительной синхронизации всех активных портов
    async forceSyncAllPorts() {
        console.log('[PORT SYNC] Принудительная синхронизация всех активных портов...');
        await this.syncActivePortsWithServers();
    }
}
