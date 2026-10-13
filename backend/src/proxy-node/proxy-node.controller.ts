import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Req, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ProxyServerService } from "../proxy-server/proxy-server.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoggerService } from "../logger/logger.service";
import { Prisma, ProxyStatus, ProxyType } from "@prisma/client";
import { isDevEnv } from "../shared/utils/is-dev";
import { NodeService } from "../node/node.service";
import { timingSafeEqual } from "crypto";

// These are the only database columns used by traffic accounting. Keep this
// allowlist next to the raw SQL below so the dynamic identifier can never come
// from a request body.
const TRAFFIC_DB_COLUMN_BY_FIELD: Record<string, string> = {
    residentTrafficLeft: "resident_traffic_left",
    premiumTrafficLeft: "premium_trafic_left",
    mobileGbTrafficLeft: "mobile_gb_traffic_left",
    ipv6GbTrafficLeft: "ipv6_gb_traffic_left",
    ispUsaTrafficLeft: "isp_usa_traffic_left",
    ispEuTrafficLeft: "isp_eu_traffic_left",
    residentialLiteTrafficLeft: "residential_lite_traffic_left",
};

@Controller("proxy-node")
export class ProxyNodeController {
    private readonly logger = new Logger(ProxyNodeController.name);

    constructor(
        private proxyServerService: ProxyServerService,
        private prisma: PrismaService,
        private loggerService: LoggerService,
        private nodeService: NodeService,
    ) {}

    private async authenticateNode(serverId: string, req: any) {
        const bearer = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
        if (!serverId || !bearer) throw new UnauthorizedException("Требуются идентификатор и токен прокси-ноды");
        const server = await this.prisma.proxyServer.findFirst({
            where: { host: serverId, status: "ACTIVE" },
            select: { host: true, token: true },
        });
        if (!server?.token) throw new UnauthorizedException("Неизвестная прокси-нода");
        const expected = Buffer.from(server.token);
        const received = Buffer.from(bearer);
        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
            throw new UnauthorizedException("Неверный токен прокси-сервера");
        }
        return server;
    }

    // Регистрация допускается только с заранее выданным администратором токеном.
    // IP сервера: body.ip или body.server_id (для дебага) → иначе x-forwarded-for / req.ip
    @Post("/register")
    @HttpCode(HttpStatus.OK)
    async registerProxyNode(@Body() body: { server_id?: string; ip?: string }, @Req() req: any) {
        // IP, с которого пришёл запрос (для логов и ответа)
        const requestIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";
        // IP сервера для поиска в БД: кастомный из body (дебаг) или из запроса
        const serverIp = body.ip ?? body.server_id ?? requestIp;

        this.logger.log(`[REGISTER] Запрос от IP: ${requestIp}, сервер для регистрации: ${serverIp}`);

        if (!serverIp) {
            throw new BadRequestException("Не удалось определить IP адрес сервера (передайте ip или server_id в body, или запрос должен содержать X-Forwarded-For / req.ip)");
        }
        await this.authenticateNode(serverIp, req);

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
    @Post("/traffic")
    @HttpCode(HttpStatus.OK)
    async receiveTraffic(@Body() body: any, @Req() req: any) {
        const serverId = typeof body.server_id === "string" ? body.server_id.trim() : "";
        const reportingServer = await this.authenticateNode(serverId, req);

        const batchId = typeof body.batch_id === "string" ? body.batch_id.trim() : "";
        if (batchId && !/^[a-f0-9]{32}$/i.test(batchId)) {
            throw new BadRequestException("Некорректный batch_id отчёта трафика");
        }

        if (isDevEnv) {
            const n = body.logs?.length ?? 0;
            this.logger.debug(`[TRAFFIC] ip=${req.ip ?? "?"} server=${body.server_id ?? "?"} logs=${n} in=${body.total_in ?? 0} out=${body.total_out ?? 0}`);
        }

        const now = new Date();
        const trafficByLogin = new Map<string, { inBytes: bigint; outBytes: bigint }>();
        for (const log of Array.isArray(body.logs) ? body.logs : []) {
            const login = log?.user || log?.login;
            if (typeof login !== "string" || !login) continue;
            const inBytes = BigInt(log.in_bytes || 0);
            const outBytes = BigInt(log.out_bytes || 0);
            if (inBytes < 0n || outBytes < 0n) throw new BadRequestException("Отрицательный трафик недопустим");
            if (inBytes + outBytes === 0n) continue;
            const existing = trafficByLogin.get(login) ?? { inBytes: 0n, outBytes: 0n };
            existing.inBytes += inBytes;
            existing.outBytes += outBytes;
            trafficByLogin.set(login, existing);
        }

        const proxiesToSuspend: Array<{ id: string; serverHost: string | null; userLogin: string | null; type: ProxyType }> = [];
        const usageEvents: Array<{
            userId: string;
            login: string;
            totalBytes: bigint;
            inBytes: bigint;
            outBytes: bigint;
            type: string;
            proxyType: ProxyType;
            port: number;
        }> = [];
        let duplicateBatch = false;

        try {
            await this.prisma.$transaction(async (tx) => {
                if (batchId) {
                    try {
                        await tx.proxyTrafficBatchReceipt.create({
                            data: { id: batchId, serverHost: reportingServer?.host ?? null },
                        });
                    } catch (error) {
                        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                            duplicateBatch = true;
                        }
                        throw error;
                    }
                }

                const trafficByPackage = new Map<string, { inBytes: bigint; outBytes: bigint }>();
                for (const [login, traffic] of trafficByLogin.entries()) {
                    const totalBytes = traffic.inBytes + traffic.outBytes;
                    const proxy = await tx.proxy.findFirst({
                        where: {
                            userLogin: login,
                            ...(reportingServer ? { serverHost: reportingServer.host } : {}),
                        },
                        include: { user: true, userPackage: true },
                    });
                    if (!proxy || !proxy.user) {
                        // A proxy may have been revoked after its last bytes were
                        // sampled. Ignore that stale login without rejecting the
                        // whole batch (which may also contain active customers).
                        continue;
                    }

                    await tx.$executeRawUnsafe(
                        `UPDATE "proxies"
                         SET "last_activity_at" = $1,
                             "traffic_used" = (CAST("traffic_used" AS NUMERIC) + $2::numeric)::text
                         WHERE "id" = $3`,
                        now,
                        totalBytes.toString(),
                        proxy.id,
                    );

                    if (proxy.userPackageId) {
                        await tx.userPackage.update({ where: { id: proxy.userPackageId }, data: { updatedAt: now } });
                        const current = trafficByPackage.get(proxy.userPackageId) ?? { inBytes: 0n, outBytes: 0n };
                        current.inBytes += traffic.inBytes;
                        current.outBytes += traffic.outBytes;
                        trafficByPackage.set(proxy.userPackageId, current);
                    }

                    let trafficField: keyof typeof TRAFFIC_DB_COLUMN_BY_FIELD | null = null;
                    let typeLabel = "";
                    if (proxy.type === ProxyType.RESIDENT) [trafficField, typeLabel] = ["residentTrafficLeft", "RESIDENT"];
                    else if (proxy.type === ProxyType.RESIDENT_PREMIUM) [trafficField, typeLabel] = ["premiumTrafficLeft", "RESIDENT_PREMIUM"];
                    else if (proxy.type === ProxyType.MOBILE_GB) [trafficField, typeLabel] = ["mobileGbTrafficLeft", "MOBILE_GB"];
                    else if (proxy.type === ProxyType.IPV6_GB) [trafficField, typeLabel] = ["ipv6GbTrafficLeft", "IPV6_GB"];
                    else if ((proxy.type as string) === "ISP_USA") [trafficField, typeLabel] = ["ispUsaTrafficLeft", "ISP_USA"];
                    else if ((proxy.type as string) === "ISP_EU") [trafficField, typeLabel] = ["ispEuTrafficLeft", "ISP_EU"];
                    else if ((proxy.type as string) === "RESIDENTIAL_LITE") [trafficField, typeLabel] = ["residentialLiteTrafficLeft", "RESIDENTIAL_LITE"];

                    // ProxyEmpire premium tariffs retain their provider-side
                    // accounting. They still contribute to gateway/package logs,
                    // but must not debit the ordinary GB balances here.
                    if (!trafficField) continue;
                    const trafficColumn = TRAFFIC_DB_COLUMN_BY_FIELD[trafficField];
                    const balanceRows = await tx.$queryRawUnsafe<Array<{ balance: string }>>(
                        `UPDATE "users"
                         SET "${trafficColumn}" = GREATEST(CAST("${trafficColumn}" AS NUMERIC) - $1::numeric, 0)::text
                         WHERE "id" = $2
                         RETURNING "${trafficColumn}" AS balance`,
                        totalBytes.toString(),
                        proxy.userId,
                    );
                    const newBalance = BigInt(balanceRows[0]?.balance || "0");
                    usageEvents.push({
                        userId: proxy.userId!,
                        login,
                        totalBytes,
                        inBytes: traffic.inBytes,
                        outBytes: traffic.outBytes,
                        type: typeLabel,
                        proxyType: proxy.type,
                        port: proxy.userPort ?? 0,
                    });

                    if (newBalance === 0n && proxy.status === ProxyStatus.ACTIVE) {
                        const related = await tx.proxy.findMany({
                            where: {
                                ...(proxy.userPackageId ? { userPackageId: proxy.userPackageId } : { userId: proxy.userId, type: proxy.type }),
                                status: ProxyStatus.ACTIVE,
                                userLogin: { not: null },
                            },
                            select: { id: true, serverHost: true, userLogin: true, type: true },
                        });
                        for (const candidate of related) {
                            if (!proxiesToSuspend.some((item) => item.id === candidate.id)) proxiesToSuspend.push(candidate);
                        }
                    }
                }

                for (const [userPackageId, traffic] of trafficByPackage.entries()) {
                    const hour = new Date(now);
                    hour.setMinutes(0, 0, 0);
                    await tx.trafficLog.upsert({
                        where: { userPackageId_date_hour: { userPackageId, date: hour, hour: hour.getHours() } },
                        create: { userPackageId, date: hour, hour: hour.getHours(), inBytes: traffic.inBytes, outBytes: traffic.outBytes },
                        update: { inBytes: { increment: traffic.inBytes }, outBytes: { increment: traffic.outBytes } },
                    });
                }

                if (proxiesToSuspend.length > 0) {
                    await tx.proxy.updateMany({
                        where: { id: { in: proxiesToSuspend.map((proxy) => proxy.id) } },
                        data: { status: ProxyStatus.SUSPENDED },
                    });
                }
            });
        } catch (error) {
            if (duplicateBatch) {
                this.logger.debug(`[TRAFFIC] duplicate batch ${batchId} ignored`);
                return { success: true, duplicate: true, message: "Traffic batch already applied" };
            }
            throw error;
        }

        // Logging and gateway control calls are deliberately outside the DB
        // transaction: they must not cause a committed batch to be retried/billed again.
        await Promise.allSettled(
            usageEvents.flatMap((event) => [
                this.loggerService.log(
                    "USAGE",
                    `Пользователь ${event.userId} потратил ${event.totalBytes} байт трафика на ${event.type} прокси (логин ${event.login}).`,
                    event.userId,
                    { used: event.totalBytes.toString(), in: event.inBytes.toString(), out: event.outBytes.toString(), type: event.type },
                    true,
                ),
                this.loggerService.logTraffic({
                    userId: event.userId,
                    packageType: event.type,
                    proxyType: event.proxyType,
                    port: event.port,
                    inBytes: event.inBytes,
                    outBytes: event.outBytes,
                }),
            ]),
        );

        for (const proxy of proxiesToSuspend) {
            if (!proxy.serverHost || !proxy.userLogin) continue;
            try {
                const server = await this.prisma.proxyServer.findFirst({ where: { host: proxy.serverHost }, select: { token: true } });
                if (server?.token) await this.proxyServerService.blockLoginOnServer(proxy.serverHost, proxy.userLogin, server.token);
            } catch (error: any) {
                this.logger.error(`[TRAFFIC] Ошибка при блокировке логина ${proxy.userLogin} на ${proxy.serverHost}: ${error.message}`);
            }
        }
        if (proxiesToSuspend.length > 0) {
            this.nodeService.syncActivePortsWithServers().catch((error: any) => {
                this.logger.error(`[TRAFFIC] Ошибка при синхронизации портов после блокировки: ${error.message}`);
            });
            this.logger.log(`[TRAFFIC] заблокировано прокси: ${proxiesToSuspend.length}, запланирован sync портов`);
        }

        return { success: true, message: "Traffic received" };
    }
}
