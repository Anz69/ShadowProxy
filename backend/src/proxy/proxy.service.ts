import { BadRequestException, forwardRef, HttpException, Inject, Injectable, InternalServerErrorException, NotFoundException, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { MangoProxyProvider } from "./providers/services/mango-proxy.provider";
import { UserService } from "../user/user.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "../logger/logger.service";
import { LteSocksProvider } from "./providers/services/lte-socks.provider";
import { ProxyType, ProxyStatus, User, LogType } from "@prisma/client";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OnEvent } from "@nestjs/event-emitter";
import { MobileProxyPlan } from "./providers/types/mobile-proxy-plan.type";
import { Prisma } from "@prisma/client";
import { NodeService } from "../node/node.service";
import { IssueIspProxyDto } from "./dtos/issue-isp-proxy.dto";
import { Proxy922Provider } from "./providers/services/proxy-922.provider";
import { MobileGbProvider } from "./providers/services/mobile-gb.provider";
import { ProxyEmpireProvider } from "./providers/services/proxy-empire.provider";
import { IspEuProvider } from "./providers/services/isp-eu.provider";
import { IssueMobileGbProxyDto } from "./dtos/issue-mobile-gb-proxy.dto";
import { sleep } from "../shared/utils/sleep";
import { IssuePremiumResidentialProxyDto } from "./dtos/issue-premium-residential-proxy.dto";
import { IssueMobileV2ProxyDto } from "./dtos/issue-mobile-v2-proxy.dto";
import { v4 } from "uuid";
import { regionToServer } from "../shared/utils/region-to-server";
import type { GetProxiesQueryParams, PaginatedProxies } from "./types/get-paginated-proxies.type";
import { splitByChunks } from "../shared/utils/split-by-chunks";
import { ModifyProxiesDto } from "./dtos/modify-proxies.dto";
import { IssueSubIspProxyDto } from "../sub/dtos/issue-sub-isp-proxy.dto";
import * as net from "net";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { MOBILE_GB_ALLOWED_ISO2_LOWER, isMobileGbCountryAllowed } from "../shared/constants/mobile-gb-allowed-countries";
import { reconcileProxyEmpireUsage } from "./utils/proxy-empire-usage";

@Injectable()
export class ProxyService implements OnModuleInit {
    private proxyEmpireSyncRunning = false;
    private readonly quotaWarnings = new Map<string, number>();
    private readonly usageSyncFailures = new Map<string, { reason: string; loggedAt: number }>();
    availableLocations: {
        resident: string[];
        premium: string[];
        premiumResidential: string[];
        mobile: string[];
        mobileGb: string[];
        isp: string[];
        ipv6: string[];
        ispUsa: string[];
        ispEu: string[];
        residentialLite: string[];
    } = {
        resident: [],
        premium: [],
        premiumResidential: [],
        mobile: [],
        mobileGb: [...MOBILE_GB_ALLOWED_ISO2_LOWER],
        isp: [],
        ipv6: [],
        // ISP_USA — страна фиксирована (US, гео не выбирается).
        ispUsa: ["us"],
        // ISP_EU — фиксированный allowed-список провайдера (см. IspEuProvider).
        ispEu: [],
        // RESIDENTIAL_LITE — любая страна (заполняется из резидентского списка).
        residentialLite: [],
    };
    availableMobileProxyPlans: MobileProxyPlan[] = [];

    constructor(
        private readonly nodeService: NodeService,
        private readonly mangoProxyProvider: MangoProxyProvider,
        private readonly proxy922Provider: Proxy922Provider,
        private readonly mobileGbProvider: MobileGbProvider,
        private readonly lteSocksProvider: LteSocksProvider,
        private readonly proxyEmpireProvider: ProxyEmpireProvider,
        private readonly ispEuProvider: IspEuProvider,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly logger: LoggerService,
    ) {}

    /** URL проверки прокси: публичный HOST + /api/health/check (тело ответа — текст `ok`). */
    private getProxyHealthVerifyUrl(): string {
        const base = this.configService.getOrThrow<string>("HOST").trim().replace(/\/+$/, "");
        return `${base}/api/health/check`;
    }

    async onModuleInit() {
        await this.parseAvailableLocations();
        await this.parseMobileProxyLocationsAndPlans();
    }


    public isNodeGatewayEnabled(): boolean {
        return this.configService.get<string>("USE_NODE_GATEWAY") === "true";
    }

    private getPublicProxyHost(internalHost: string | null): string | null {
        if (!internalHost) return internalHost;
        const configured = this.configService.get<string>("PROXY_PUBLIC_HOST", "").trim();
        if (!configured) return internalHost;
        return configured.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").split(":")[0] || internalHost;
    }

    async issueIspProxy(dto: IssueIspProxyDto, userId: string) {
        if (dto.location.length !== 2 && dto.location !== "GLOBAL") {
            throw new BadRequestException("validation.UNKNOWN_LOCATION_FORMAT");
        }
        const actualUser = await this.userService.findById(userId);
        const unactivatedUserProxies = await this.findMany({
            where: {
                userId,
                rentTime: null,
                type: ProxyType.IPV6_GB,
            },
        });
        if (actualUser.ispIpLeft - unactivatedUserProxies.length < dto.quantity) {
            throw new HttpException("errors.insufficient_balance", 402);
        }

        if (!this.isNodeGatewayEnabled()) {
            const validProxies: Prisma.ProxyCreateManyInput[] = [];
            for (let i = 0; i < dto.quantity; i++) {
                const p = this.proxy922Provider.createProxy(dto.location);
                const isWorking = await this.testProviderProxyConnection(p.host, p.port, p.username, p.password);
                if (!isWorking) {
                    this.logger.log("SYSTEM", `❌ ISP прокси провайдера не работает: ${p.host}:${p.port}`, userId);
                    continue;
                }
                validProxies.push({
                    host: p.host,
                    port: p.port,
                    username: p.username,
                    password: p.password,
                    type: "IPV6_GB",
                    rotation: "AUTO",
                    country: dto.location,
                    userId,
                    userPort: p.port,
                    userLogin: p.username,
                    userPassword: p.password,
                    serverHost: null,
                    userPackageId: null,
                    status: ProxyStatus.ACTIVE,
                } as any);
            }
            if (!validProxies.length) {
                throw new InternalServerErrorException("errors.proxy_unknown_error");
            }
            return this.prisma.$transaction(validProxies.map((proxy) => this.prisma.proxy.create({ data: proxy })));
        }

        const isPortsAvailable = await this.nodeService.getPortsAvailability(dto.quantity, regionToServer(dto.location));
        if (!isPortsAvailable) {
            throw new InternalServerErrorException("errors.node_insufficient_resources");
        }
        const providerProxies: { connectionString: string; id: string }[] = [];
        for (let i = 0; i < dto.quantity; i++) {
            const proxy = this.proxy922Provider.createProxy(dto.location);
            providerProxies.push({
                connectionString: `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`,
                id: v4(),
            });
        }
        const createdProxies = await this.nodeService.createProxy(providerProxies, regionToServer(dto.location));

        // ВАЖНО: Проверяем каждый прокси перед созданием записи в БД
        const validProxies: Prisma.ProxyCreateManyInput[] = [];
        for (const proxy of createdProxies) {
            // Проверяем подключение к провайдерскому прокси (используем данные из providerProxies)
            const providerProxy = providerProxies.find(p => p.id === proxy.id);
            if (providerProxy) {
                // Извлекаем данные из connectionString
                const match = providerProxy.connectionString.match(/http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
                if (match) {
                    const [, username, password, host, port] = match;
                    const isProxyWorking = await this.testProviderProxyConnection(host, parseInt(port), username, password);

                    if (!isProxyWorking) {
                        // Прокси не работает - не добавляем в БД
                        this.logger.log("SYSTEM", `Прокси провайдера не работает, не создан в БД: ${host}:${port}`, userId);
                        continue;
                    }
                }
            }

            validProxies.push({
                ...proxy,
                type: "IPV6_GB",
                rotation: "AUTO",
                country: dto.location,
                userId: userId,
                userPort: proxy.port, // port от nodeService - это userPort
                userLogin: proxy.username,
                userPassword: proxy.password,
                serverHost: null, // для ISP прокси сервер устанавливается позже?
                userPackageId: null,
                status: ProxyStatus.ACTIVE, // Активируем только рабочие прокси
            } as any);
        }

        return this.prisma.$transaction(validProxies.map((proxy) => this.prisma.proxy.create({ data: proxy })));
    }

    async issueSubIspProxy(dto: IssueSubIspProxyDto) {
        if (dto.location.length !== 2 && dto.location !== "GLOBAL") {
            throw new BadRequestException("validation.UNKNOWN_LOCATION_FORMAT");
        }
        const actualUser = await this.prisma.subAccount.findUnique({
            where: {
                username: dto.username,
            },
        });
        const unactivatedUserProxies = await this.findMany({
            where: {
                sub: actualUser!.id,
                rentTime: null,
                type: ProxyType.IPV6_GB,
            },
        });
        if ((actualUser?.ipLeft || 0) - unactivatedUserProxies.length < dto.quantity) {
            throw new HttpException("errors.insufficient_balance", 402);
        }

        if (!this.isNodeGatewayEnabled()) {
            const validProxies: Prisma.ProxyCreateManyInput[] = [];
            for (let i = 0; i < dto.quantity; i++) {
                const p = this.proxy922Provider.createProxy(dto.location);
                const isWorking = await this.testProviderProxyConnection(p.host, p.port, p.username, p.password);
                if (!isWorking) {
                    this.logger.log("SYSTEM", `❌ Sub ISP прокси провайдера не работает: ${p.host}:${p.port}`, actualUser!.id);
                    continue;
                }
                validProxies.push({
                    host: p.host,
                    port: p.port,
                    username: p.username,
                    password: p.password,
                    type: "IPV6_GB",
                    rotation: "AUTO",
                    country: dto.location,
                    sub: actualUser!.id,
                    userId: this.configService.getOrThrow<string>("SUB_USER_ID"),
                    userPort: p.port,
                    userLogin: p.username,
                    userPassword: p.password,
                    serverHost: null,
                    userPackageId: null,
                    status: ProxyStatus.ACTIVE,
                } as any);
            }
            if (!validProxies.length) {
                throw new InternalServerErrorException("errors.proxy_unknown_error");
            }
            return this.prisma.$transaction(validProxies.map((proxy) => this.prisma.proxy.create({ data: proxy })));
        }

        const isPortsAvailable = await this.nodeService.getPortsAvailability(dto.quantity, regionToServer(dto.location));
        if (!isPortsAvailable) {
            throw new InternalServerErrorException("errors.node_insufficient_resources");
        }
        const providerProxies: { connectionString: string; id: string }[] = [];
        for (let i = 0; i < dto.quantity; i++) {
            const proxy = this.proxy922Provider.createProxy(dto.location);
            providerProxies.push({
                connectionString: `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`,
                id: v4(),
            });
        }
        const createdProxies = await this.nodeService.createProxy(providerProxies, regionToServer(dto.location));
        
        // ВАЖНО: Проверяем каждый прокси перед созданием записи в БД
        const validProxies: Prisma.ProxyCreateManyInput[] = [];
        for (const proxy of createdProxies) {
            // Проверяем подключение к провайдерскому прокси (используем данные из providerProxies)
            const providerProxy = providerProxies.find(p => p.id === proxy.id);
            if (providerProxy) {
                // Извлекаем данные из connectionString
                const match = providerProxy.connectionString.match(/http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
                if (match) {
                    const [, username, password, host, port] = match;
                    const isProxyWorking = await this.testProviderProxyConnection(host, parseInt(port), username, password);
                    
                    if (!isProxyWorking) {
                        // Прокси не работает - не добавляем в БД
                        this.logger.log("SYSTEM", `Прокси провайдера не работает, не создан в БД: ${host}:${port}`, actualUser!.id);
                        continue;
                    }
                }
            }
            
            validProxies.push({
                ...proxy,
                type: "IPV6_GB",
                rotation: "AUTO",
                country: dto.location,
                sub: actualUser!.id,
                userId: this.configService.getOrThrow<string>("SUB_USER_ID"),
                userPort: proxy.port,
                userLogin: proxy.username,
                userPassword: proxy.password,
                serverHost: null,
                userPackageId: null,
                status: ProxyStatus.ACTIVE, // Активируем только рабочие прокси
            } as any);
        }

        return this.prisma.$transaction(validProxies.map((proxy) => this.prisma.proxy.create({ data: proxy })));
    }

    async issueMobileGbProxy(dto: IssueMobileGbProxyDto, userId: string) {
        const loc = dto.location?.trim() ?? "";
        if (loc.toUpperCase() === "GLOBAL" || loc.length !== 2 || !isMobileGbCountryAllowed(loc)) {
            throw new BadRequestException("validation.UNKNOWN_LOCATION_FORMAT");
        }

        // Проверяем, что для BY_TIME указан rotationInterval
        if (dto.rotation === "BY_TIME" && !dto.rotationInterval) {
            throw new BadRequestException("rotationInterval обязателен для ротации по времени");
        }
        
        const actualUser = await this.userService.findById(userId, true, false);
        const unactivatedUserProxies = await this.findMany({
            where: {
                userId,
                rentTime: null,
                type: ProxyType.MOBILE_GB,
            },
        });
        
        const mobileGbTrafficLeft = (actualUser as any).mobileGbTrafficLeft || "0";
        if (BigInt(mobileGbTrafficLeft) - BigInt(unactivatedUserProxies.length) < BigInt(dto.quantity)) {
            throw new HttpException("errors.insufficient_balance", 402);
        }
        
        // Для MOBILE_GB прокси не нужен node-сервер - создаем напрямую через провайдера
        const rotationTime = dto.rotation === "BY_TIME" ? dto.rotationInterval : undefined;
        const validProxies: Prisma.ProxyCreateManyInput[] = [];
        
        for (let i = 0; i < dto.quantity; i++) {
            const providerProxy = this.mobileGbProvider.createProxy(loc, rotationTime);
            
            // Проверяем работоспособность прокси провайдера
            const isProxyWorking = await this.testProviderProxyConnection(
                providerProxy.host,
                providerProxy.port,
                providerProxy.username,
                providerProxy.password
            );
            
            if (!isProxyWorking) {
                this.logger.log("SYSTEM", `❌ MOBILE_GB прокси провайдера не работает: ${providerProxy.host}:${providerProxy.port}`, userId);
                continue; // Пропускаем нерабочий прокси
            }
            
            validProxies.push({
                host: providerProxy.host,
                port: providerProxy.port,
                username: providerProxy.username,
                password: providerProxy.password,
                type: "MOBILE_GB",
                rotation: dto.rotation === "BY_TIME" ? "BY_TIME" : "BY_REQUEST",
                rotationInterval: dto.rotation === "BY_TIME" ? dto.rotationInterval : null,
                country: loc.toUpperCase(),
                userId: userId,
                userPort: providerProxy.port,
                userLogin: providerProxy.username,
                userPassword: providerProxy.password,
                serverHost: null,
                userPackageId: null,
                status: ProxyStatus.ACTIVE,
            } as any);
        }

        if (validProxies.length === 0) {
            throw new InternalServerErrorException("errors.proxy_unknown_error");
        }

        const createdProxies = await this.prisma.$transaction(validProxies.map((proxy) => this.prisma.proxy.create({ data: proxy })));
        
        // Возвращаем результат в формате массива (даже для одного прокси)
        return createdProxies;
    }

    async getProxyEmpireRegions(connectionType: "residential" | "mobile", countryCode: string) {
        return this.proxyEmpireProvider.getRegions(connectionType, countryCode);
    }

    async getProxyEmpireCities(connectionType: "residential" | "mobile", countryCode: string, region?: string) {
        return this.proxyEmpireProvider.getCities(connectionType, countryCode, region);
    }

    async getProxyEmpireIsps(connectionType: "residential" | "mobile", countryCode: string, region?: string, city?: string) {
        return this.proxyEmpireProvider.getIsps(connectionType, countryCode, region, city);
    }

    // Mango Residential Proxy filters (задача 2 ТЗ).
    async getMangoRegions(countryCode: string): Promise<string[]> {
        if (!countryCode) return [];
        return this.mangoProxyProvider.getStates(countryCode);
    }

    async getMangoCities(countryCode: string, region?: string): Promise<string[]> {
        if (!countryCode) return [];
        return this.mangoProxyProvider.getCities(countryCode, region);
    }

    async getMangoIsps(countryCode: string, region?: string, city?: string): Promise<string[]> {
        if (!countryCode) return [];
        return this.mangoProxyProvider.getAsns(countryCode, region, city);
    }

    async ensureProxyEmpireSubUser(userId: string): Promise<string | null> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            await this.logger.error(`ensureProxyEmpireSubUser: user ${userId} not found in DB`);
            return null;
        }
        const u = user as any;
        if (u.proxyEmpireSubUserToken && u.proxyEmpireSubUserEmail) {
            return u.proxyEmpireSubUserToken as string;
        }
        await this.logger.log("SYSTEM", `ensureProxyEmpireSubUser: создаём PE sub-user для ${user.email}`, userId);
        const created = await this.proxyEmpireProvider.createSubUser(user.email, user.email);
        if (!created) {
            await this.logger.error(`ensureProxyEmpireSubUser: createSubUser вернул null для ${user.email} — см. логи выше`, userId);
            return null;
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                proxyEmpireSubUserEmail: created.email,
                proxyEmpireSubUserToken: created.apiToken,
            } as any,
        });
        await this.logger.log("SYSTEM", `ensureProxyEmpireSubUser: PE sub-user создан для ${user.email}`, userId);
        return created.apiToken;
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async syncProxyEmpireUsage() {
        if (this.configService.get<string>("ENABLE_PROXYEMPIRE_USAGE_SYNC") === "false") return;
        if (this.proxyEmpireSyncRunning) return;
        this.proxyEmpireSyncRunning = true;
        try {
            await this.syncProxyEmpireUsageOnce();
        } finally {
            this.proxyEmpireSyncRunning = false;
        }
    }

    private async syncProxyEmpireUsageOnce() {
        if (this.configService.get<string>("ENABLE_PROXYEMPIRE_BACKFILL") === "true") {
            const stragglers = await this.prisma.user.findMany({
            where: {
                proxyEmpireSubUserEmail: null,
                OR: [
                    { premiumResidentialTrafficLeft: { not: "0" } } as any,
                    { mobileTrafficLeft: { not: "0" } } as any,
                ],
            } as any,
            select: { id: true, email: true, premiumResidentialTrafficLeft: true, mobileTrafficLeft: true } as any,
            });
            for (const s of stragglers as unknown as Array<{ id: string; email: string; premiumResidentialTrafficLeft: string; mobileTrafficLeft: string }>) {
            try {
                const apiToken = await this.ensureProxyEmpireSubUser(s.id);
                if (!apiToken) {
                    await this.logger.error(`PE backfill: не смог создать sub-user для ${s.email} — PE возможно держит email`, s.id);
                    continue;
                }
                const prBytes = Number(BigInt(s.premiumResidentialTrafficLeft || "0"));
                const mobileBytes = Number(BigInt(s.mobileTrafficLeft || "0"));
                if (prBytes > 0) await this.proxyEmpireProvider.setSubUserBandwidth(s.email, "residential", prBytes);
                if (mobileBytes > 0) await this.proxyEmpireProvider.setSubUserBandwidth(s.email, "mobile", mobileBytes);
                await this.logger.log("SYSTEM", `PE backfill: sub-user ${s.email} создан и квота залита (resi=${prBytes}, mobile=${mobileBytes} байт)`, s.id);
            } catch (e: any) {
                await this.logger.error(`PE backfill ${s.email} failed: ${e?.message || String(e)}`, s.id);
            }
            }
        }

        const users = await this.prisma.user.findMany({
            where: { proxyEmpireSubUserEmail: { not: null } } as any,
            select: {
                id: true,
                email: true,
                proxyEmpireSubUserEmail: true,
                premiumResidentialTrafficLeft: true,
                mobileTrafficLeft: true,
                proxyEmpireResiUsedSnapshot: true,
                proxyEmpireMobileUsedSnapshot: true,
            } as any,
        });
        for (const u of users as unknown as Array<{
            id: string;
            email: string;
            proxyEmpireSubUserEmail: string;
            premiumResidentialTrafficLeft: string;
            mobileTrafficLeft: string;
            proxyEmpireResiUsedSnapshot: string;
            proxyEmpireMobileUsedSnapshot: string;
        }>) {
            try {
                const pendingPayment = await this.prisma.payment.findFirst({
                    where: { userId: u.id, status: "PAID", metadata: { path: ["provisioningPending"], not: Prisma.AnyNull } },
                    select: { id: true },
                });
                // A purchased local credit must not be mistaken for consumed
                // traffic while provider provisioning is still pending.
                if (pendingPayment) continue;
                const info = await this.proxyEmpireProvider.getSubUserInfo(u.proxyEmpireSubUserEmail);
                if (!info) continue;
                const resi = reconcileProxyEmpireUsage(u.premiumResidentialTrafficLeft, u.proxyEmpireResiUsedSnapshot, info.residential);
                const mobile = reconcileProxyEmpireUsage(u.mobileTrafficLeft, u.proxyEmpireMobileUsedSnapshot, info.mobile);
                if (resi.mismatch || mobile.mismatch) {
                    const lastWarning = this.quotaWarnings.get(u.id) ?? 0;
                    if (Date.now() - lastWarning >= 3600000) {
                        this.quotaWarnings.set(u.id, Date.now());
                        await this.logger.log("SYSTEM", `PE quota mismatch: resi=${resi.mismatch} mobile=${mobile.mismatch}; balances preserved, provider quota needs review`, u.id);
                    }
                } else {
                    this.quotaWarnings.delete(u.id);
                }

                if (resi.left !== u.premiumResidentialTrafficLeft || mobile.left !== u.mobileTrafficLeft ||
                    resi.snapshot !== u.proxyEmpireResiUsedSnapshot || mobile.snapshot !== u.proxyEmpireMobileUsedSnapshot) {
                    const result = await this.prisma.user.updateMany({
                        where: {
                            id: u.id,
                            premiumResidentialTrafficLeft: u.premiumResidentialTrafficLeft,
                            mobileTrafficLeft: u.mobileTrafficLeft,
                            proxyEmpireResiUsedSnapshot: u.proxyEmpireResiUsedSnapshot,
                            proxyEmpireMobileUsedSnapshot: u.proxyEmpireMobileUsedSnapshot,
                        },
                        data: {
                            premiumResidentialTrafficLeft: resi.left,
                            mobileTrafficLeft: mobile.left,
                            proxyEmpireResiUsedSnapshot: resi.snapshot,
                            proxyEmpireMobileUsedSnapshot: mobile.snapshot,
                        },
                    });
                    if (result.count === 0) continue; // a purchase or another sync changed this row
                    await this.logger.log(
                        "SYSTEM",
                        `PE usage sync ${u.email}: -resi=${resi.charged} -mobile=${mobile.charged} | left resi=${resi.left} mobile=${mobile.left}`,
                        u.id,
                    );
                    if (resi.charged > 0n) {
                        await this.logger.log(
                            "USAGE",
                            `Пользователь ${u.id} потратил ${resi.charged} байт трафика (Premium Residential).`,
                            u.id,
                            { used: String(resi.charged), type: "PREMIUM_RESIDENTIAL" },
                            true,
                        );
                        await this.logger.recordTrafficLogForUserTariff(u.id, "PREMIUM_RESIDENTIAL", resi.charged);
                    }
                    if (mobile.charged > 0n) {
                        await this.logger.log(
                            "USAGE",
                            `Пользователь ${u.id} потратил ${mobile.charged} байт трафика (Mobile).`,
                            u.id,
                            { used: String(mobile.charged), type: "MOBILE" },
                            true,
                        );
                        await this.logger.recordTrafficLogForUserTariff(u.id, "MOBILE", mobile.charged);
                    }
                }
                // A successful reconciliation resets suppression so a later
                // recurrence is visible immediately, even within the same hour.
                this.usageSyncFailures.delete(u.id);
            } catch (error: unknown) {
                const reason = error instanceof Error ? error.message : String(error);
                const previous = this.usageSyncFailures.get(u.id);
                const now = Date.now();
                if (!previous || previous.reason !== reason || now - previous.loggedAt >= 3600000) {
                    if (this.usageSyncFailures.size >= 10000) {
                        const oldest = this.usageSyncFailures.keys().next().value;
                        if (oldest !== undefined) this.usageSyncFailures.delete(oldest);
                    }
                    this.usageSyncFailures.set(u.id, { reason, loggedAt: now });
                    await this.logger.error(`PE usage sync failed for ${u.email}: ${reason}; одинаковые ошибки ограничены одной записью в час`, u.id);
                }
            }
        }
    }

    @OnEvent("payment.provision", { suppressErrors: false })
    async provisionPaidTraffic(payload: { tariff: string; userId: string; paymentId: string }) {
        const { tariff, userId, paymentId } = payload;
        if (tariff !== "PREMIUM_RESIDENTIAL" && tariff !== "MOBILE") return;
        if (!await this.ensureProxyEmpireSubUser(userId)) {
            throw new ServiceUnavailableException("Не удалось подготовить клиентский аккаунт ProxyEmpire");
        }
        const peType = tariff === "MOBILE" ? "mobile" : "residential";
        const prepared = await this.prisma.$transaction(async tx => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
            const first = await tx.payment.findFirst({
                where: { userId, status: "PAID", metadata: { path: ["provisioningPending"], not: Prisma.AnyNull } },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            });
            if (first?.id !== paymentId) throw new Error("Earlier provisioning job is pending");
            const metadata = first.metadata as any;
            const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
            const email = user.proxyEmpireSubUserEmail || user.email;
            if (metadata.providerTargetTotal != null) return { email, target: Number(metadata.providerTargetTotal) };
            const info = await this.proxyEmpireProvider.getSubUserInfo(email);
            if (!info) throw new Error("Provider counters unavailable");
            // ProxyEmpire omits a tariff that has never been funded. A
            // successfully retrieved sub-user with no category starts at zero.
            const counters = info[peType] ?? { total: 0, used: 0, remaining: 0 };
            // Persist an absolute cumulative quota before calling the provider.
            // A lost acknowledgement must not grant paid traffic twice.
            const target = counters.total + Number(metadata.creditedTraffic);
            if (!Number.isSafeInteger(target)) throw new Error("Invalid provider target");
            await tx.payment.update({
                where: { id: paymentId },
                data: { metadata: { ...metadata, providerTargetTotal: String(target) } },
            });
            return { email, target };
        }, { timeout: 30000 });
        await this.prisma.$transaction(async tx => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
            if (!await this.proxyEmpireProvider.setSubUserBandwidth(prepared.email, peType, prepared.target)) {
                throw new Error("Provider bandwidth synchronization failed");
            }
        }, { timeout: 30000 });
    }

    @OnEvent("user.distribute_traffic")
    async onDistributeTrafficToProxyEmpire(payload: { tariff: string; traffic: string; userId: string }) {
        const { tariff, traffic, userId } = payload;
        if (tariff !== "PREMIUM_RESIDENTIAL" && tariff !== "MOBILE") return;
        const bytes = Number(BigInt(traffic));
        if (!Number.isFinite(bytes) || bytes <= 0) return;
        const apiToken = await this.ensureProxyEmpireSubUser(userId);
        if (!apiToken) {
            const msg = `ProxyEmpire sub-user не создался (userId=${userId}, tariff=${tariff})`;
            await this.logger.error(msg, userId);
            throw new Error(msg);
        }
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user?.email) {
            throw new Error(`User ${userId} email пустой — нельзя пополнить PE sub-user`);
        }
        const peType: "residential" | "mobile" = tariff === "PREMIUM_RESIDENTIAL" ? "residential" : "mobile";
        const ok = await this.proxyEmpireProvider.addSubUserBandwidth(user.email, peType, bytes);
        if (!ok) {
            throw new Error(`addSubUserBandwidth failed для ${user.email} (${peType}, ${bytes} байт)`);
        }
    }

    async issuePremiumResidentialProxy(dto: IssuePremiumResidentialProxyDto, userId: string) {
        const actualUser = await this.userService.findById(userId, true, false);
        const trafficLeft = BigInt((actualUser as any).premiumResidentialTrafficLeft || "0");

        if (trafficLeft <= 0n) {
            throw new HttpException("errors.insufficient_balance", 402);
        }

        const apiTokenOverride = await this.ensureProxyEmpireSubUser(userId);
        if (!apiTokenOverride) {
            throw new ServiceUnavailableException("Не удалось подготовить аккаунт Premium Residential. Трафик сохранён; повторите генерацию позже.");
        }

        const providerProxies = await this.proxyEmpireProvider.generateProxyList({
            proxyType: "residential",
            country: dto.location,
            region: dto.region,
            city: dto.city,
            isp: dto.isp,
            ipRotationType: dto.ip_rotation_type,
            sessionLifetime: dto.session_lifetime,
            length: Math.min(dto.quantity * 10, 3000),
            ...(apiTokenOverride ? { apiTokenOverride } : {}),
        });

        if (!providerProxies.length) {
            throw new InternalServerErrorException("errors.proxy_unknown_error");
        }

        const validProxies: Prisma.ProxyCreateManyInput[] = [];
        for (const p of providerProxies) {
            if (validProxies.length >= dto.quantity) break;

            const isWorking = await this.testProviderProxyConnection(p.host, p.port, p.username, p.password);
            if (!isWorking) {
                this.logger.log("SYSTEM", `❌ PREMIUM_RESIDENTIAL прокси не работает: ${p.host}:${p.port}`, userId);
                continue;
            }

            validProxies.push({
                host: p.host,
                port: p.port,
                username: p.username,
                password: p.password,
                type: "PREMIUM_RESIDENTIAL",
                rotation: "BY_REQUEST",
                country: dto.location?.toUpperCase() ?? "GLOBAL",
                userId,
                userPort: p.port,
                userLogin: p.username,
                userPassword: p.password,
                serverHost: null,
                userPackageId: null,
                status: ProxyStatus.ACTIVE,
            } as any);
        }

        if (!validProxies.length) {
            throw new InternalServerErrorException("errors.proxy_unknown_error");
        }

        return this.prisma.$transaction(validProxies.map((proxy) => this.prisma.proxy.create({ data: proxy })));
    }

    async issueMobileV2Proxy(dto: IssueMobileV2ProxyDto, userId: string) {
        const actualUser = await this.userService.findById(userId, true, false);
        const trafficLeft = BigInt((actualUser as any).mobileTrafficLeft || "0");

        if (trafficLeft <= 0n) {
            throw new HttpException("errors.insufficient_balance", 402);
        }

        const apiTokenOverride = await this.ensureProxyEmpireSubUser(userId);
        if (!apiTokenOverride) {
            throw new ServiceUnavailableException("Не удалось подготовить аккаунт Premium Mobile. Трафик сохранён; повторите генерацию позже.");
        }

        const providerProxies = await this.proxyEmpireProvider.generateProxyList({
            proxyType: "mobile",
            country: dto.location,
            region: dto.region,
            city: dto.city,
            isp: dto.isp,
            length: Math.min(dto.quantity * 10, 3000),
            ...(apiTokenOverride ? { apiTokenOverride } : {}),
        });

        if (!providerProxies.length) {
            throw new InternalServerErrorException("errors.proxy_unknown_error");
        }

        const validProxies: Prisma.ProxyCreateManyInput[] = [];
        for (const p of providerProxies) {
            if (validProxies.length >= dto.quantity) break;

            const isWorking = await this.testProviderProxyConnection(p.host, p.port, p.username, p.password);
            if (!isWorking) {
                this.logger.log("SYSTEM", `❌ MOBILE (ProxyEmpire) прокси не работает: ${p.host}:${p.port}`, userId);
                continue;
            }

            validProxies.push({
                host: p.host,
                port: p.port,
                username: p.username,
                password: p.password,
                type: "MOBILE",
                rotation: "BY_REQUEST",
                country: dto.location?.toUpperCase() ?? "GLOBAL",
                userId,
                userPort: p.port,
                userLogin: p.username,
                userPassword: p.password,
                serverHost: null,
                userPackageId: null,
                status: ProxyStatus.ACTIVE,
            } as any);
        }

        if (!validProxies.length) {
            throw new InternalServerErrorException("errors.proxy_unknown_error");
        }

        return this.prisma.$transaction(validProxies.map((proxy) => this.prisma.proxy.create({ data: proxy })));
    }

    async issueMobileProxy(plan: string, rentTime: number, user: User) {
        this.logger.log("SYSTEM", `issueMobileProxy: plan=${plan}, rentTime=${rentTime}, userRegion=${user.region}`, user.id);
        
        const cachedPlan = this.availableMobileProxyPlans.find((el) => el.id === plan);
        if (!cachedPlan) {
            this.logger.error(`План с ID ${plan} не найден. Доступно планов: ${this.availableMobileProxyPlans.length}`, user.id);
            throw new BadRequestException(`План с ID ${plan} не найден. Убедитесь, что план существует и доступен.`);
        }
        
        this.logger.log("SYSTEM", `Найден план: id=${cachedPlan.id}, countryCode=${cachedPlan.countryCode}, name=${cachedPlan.name}, tarifications=${cachedPlan.tarifications.length}`, user.id);
        
        if (!cachedPlan.tarifications || cachedPlan.tarifications.length === 0) {
            this.logger.error(`План ${plan} не имеет тарификаций`, user.id);
            throw new BadRequestException(`План ${plan} не имеет доступных тарификаций`);
        }
        
        const tarification = cachedPlan.tarifications[0];
        this.logger.log("SYSTEM", `Используется тарификация: time=${tarification.time}, traffic=${tarification.traffic}, price=${tarification.price}`, user.id);
        
        const providerProxy = await this.lteSocksProvider.createProxy(
            {
                plan,
                tarification: tarification,
            },
            user.region,
            rentTime,
        );

        if (!providerProxy) {
            this.logger.error(`Провайдер не вернул прокси для plan=${plan}`, user.id);
            return null;
        }
        
        const { host, port, username, password } = providerProxy;
        this.logger.log("SYSTEM", `Провайдер вернул прокси: ${host}:${port}, username=${username}`, user.id);
        
        // ВАЖНО: Создаем прокси со статусом SUSPENDED для проверки перед активацией
        const createdProxy = await this.prisma.proxy.create({
            data: {
                host,
                port,
                username,
                password,
                type: "MOBILE",
                rotation: "BY_REQUEST",
                rentTime,
                country: cachedPlan!.countryCode,
                userId: user.id,
                userPort: null,
                userLogin: null,
                userPassword: null,
                serverHost: null,
                userPackageId: null,
                status: ProxyStatus.SUSPENDED, // Создаем со статусом SUSPENDED
            } as any,
        });

        this.logger.log("SYSTEM", `Прокси создан в БД с ID ${createdProxy.id}, начинается проверка подключения`, user.id);

        // Проверяем подключение к провайдерскому прокси
        const isProxyWorking = await this.testProviderProxyConnection(host, port, username, password);
        
        if (!isProxyWorking) {
            // Прокси не работает - удаляем из БД
            await this.prisma.proxy.delete({
                where: { id: createdProxy.id },
            });
            this.logger.log("SYSTEM", `Прокси провайдера не работает, удален из БД: ${host}:${port}`, user.id);
            return null;
        }

        this.logger.log("SYSTEM", `Прокси работает, активируется: ${createdProxy.id}`, user.id);

        // Прокси работает - активируем
        return this.prisma.proxy.update({
            where: { id: createdProxy.id },
            data: { status: ProxyStatus.ACTIVE },
        });
    }

    async refreshProxy(id: string) {
        const proxy = await this.prisma.proxy.findUnique({
            where: {
                id,
            },
        });
        if (!proxy) {
            throw new NotFoundException("errors.proxy_not_found");
        }

        try {
            const refreshRes = await this.lteSocksProvider.refreshProxy(proxy.port);
            return {
                success: true,
                ip: refreshRes.data.ip,
            };
        } catch {
            throw new BadRequestException("errors.too_many_refresh_requests");
        }
    }

    async getPaginatedProxies(query: GetProxiesQueryParams, userId: string): Promise<PaginatedProxies> {
        let userProxies = await this.findMany({
            where: {
                userId,
                type: query.type,
            },
        });

        if (query.sort === "created_at_desc") {
            userProxies = userProxies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        if (query.sort === "created_at_asc") {
            userProxies = userProxies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }

        const totalItems = userProxies.length;
        const proxyChunks = splitByChunks(userProxies, Number(query.limit));
        const totalPages = proxyChunks.length;
        const currentPage = Math.min(Number(query.page), totalPages || 1);

        return {
            // В БД остаётся внутренний IP для control-plane, наружу отдаём DNS-имя.
            data: (proxyChunks[currentPage - 1] ?? []).map((proxy) => ({
                ...proxy,
                serverHost: this.getPublicProxyHost(proxy.serverHost),
            })),
            page: currentPage,
            totalPages,
            next: currentPage < totalPages,
            prev: currentPage > 1,
            totalItems,
        };
    }

    async modifyProxies(dto: ModifyProxiesDto, userId: string) {
        const allProxies = await this.findMany({
            where: {
                id: {
                    in: dto.proxies,
                },
                userId,
            },
        });
        
        // Валидация для IPv6 прокси
        if (dto.location) {
            const ipv6Proxies = allProxies.filter(p => p.type === ProxyType.IPV6_GB);
            if (ipv6Proxies.length > 0) {
                const validIpv6Locations = ["de", "nl"];
                if (!validIpv6Locations.includes(dto.location.toLowerCase())) {
                    throw new BadRequestException("Для IPv6 доступны только Германия (DE) и Нидерланды (NL)");
                }
            }
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { proxies: _, ...modifier } = dto;
        const modifiedProxies = allProxies.map((proxy) => {
            if (proxy.type === ProxyType.RESIDENT_PREMIUM) {
                return {
                    ...proxy,
                    username: this.mangoProxyProvider.modifyProxy(modifier, proxy.username),
                    rotation: dto.rotation,
                    rotationInterval: dto.rotationInterval,
                    country: dto.location,
                };
            }
            if (proxy.type === ProxyType.IPV6_GB && dto.location) {
                // Для IPv6 просто обновляем страну, без изменения username
                return {
                    ...proxy,
                    country: dto.location,
                };
            }
            return;
        });

        await this.prisma.$transaction(async (tx) => {
            for (const proxy of modifiedProxies.filter(Boolean)) {
                await tx.proxy.update({
                    where: {
                        id: proxy!.id,
                    },
                    data: {
                        username: proxy!.username,
                        rotation: proxy!.rotation,
                        rotationInterval: proxy?.rotationInterval,
                        country: proxy?.country,
                    },
                });
            }
        });

        return modifiedProxies;
    }

    async findMany(query: Prisma.ProxyFindManyArgs) {
        return this.prisma.proxy.findMany(query);
    }

    async updateMany(query: Prisma.ProxyUpdateManyArgs) {
        return this.prisma.proxy.updateMany(query);
    }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async parseAvailableLocations() {
        const mangoLocations = await this.mangoProxyProvider.getAvailableLocations();
        const proxyEmpireLocations = await this.proxyEmpireProvider.getAvailableLocations();

        this.availableLocations = {
            premium: [...new Set(mangoLocations.filter((el) => el !== "rsa"))],
            premiumResidential: [...new Set(proxyEmpireLocations)],
            resident: [...new Set(mangoLocations.filter((el) => el.length === 2))],
            mobile: this.availableLocations.mobile,
            mobileGb: [...MOBILE_GB_ALLOWED_ISO2_LOWER],
            isp: [...new Set(mangoLocations.filter((el) => el.length === 2))],
            ipv6: ["de", "nl"],
            ispUsa: ["us"],
            ispEu: this.ispEuProvider.getCountries().map((c) => c.toLowerCase()),
            // RESIDENTIAL_LITE — любая страна: берём широкий резидентский список.
            residentialLite: [...new Set(mangoLocations.filter((el) => el.length === 2))],
        };
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async parseMobileProxyLocationsAndPlans() {
        const plans = await this.lteSocksProvider.parsePlans();
        const locations = plans.filter((el) => el.availablePorts > 2).map((el) => el.countryCode.toLowerCase());

        this.availableLocations = {
            ...this.availableLocations,
            mobile: [...new Set(locations)],
        };
        this.availableMobileProxyPlans = plans
            .filter((el) => el.availablePorts > 2)
            .map((el) => ({
                ...el,
                countryCode: el.countryCode.toLowerCase(),
            }));
    }

    /**
     * Проверка доступности провайдерского прокси — простая TCP-проверка
     * Устанавливает соединение с host:port; если соединение успешно — прокси считается доступным
     * @returns true если удалось подключиться, false если нет
     */
    public testProviderProxyConnection(host: string, port: number, username: string, password: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.logger.log("SYSTEM", `🔍 Проверка прокси ${host}:${port} (TCP)`, undefined);
            const socket = new net.Socket();
            const timeout = 5000;

            const cleanup = () => {
                socket.removeAllListeners();
                socket.destroy();
            };

            socket.setTimeout(timeout);
            socket.on("connect", () => {
                cleanup();
                this.logger.log("SYSTEM", `✅ Прокси ${host}:${port} доступен`, undefined);
                resolve(true);
            });
            socket.on("timeout", () => {
                cleanup();
                this.logger.log("SYSTEM", `❌ Ошибка проверки прокси ${host}:${port}: таймаут соединения`, undefined);
                resolve(false);
            });
            socket.on("error", (err) => {
                cleanup();
                this.logger.log("SYSTEM", `❌ Ошибка проверки прокси ${host}:${port}: ${err.message}`, undefined);
                resolve(false);
            });

            socket.connect(port, host);
        });
    }

    /**
     * Проверка выданного прокси: реальный HTTPS через наш прокси-сервер с логином/паролем пользователя.
     * Подтверждает, что цепочка до внешки работает (не только открыт TCP-порт).
     * TLS до целевого HOST не валидируется — цель проверки только работоспособность туннеля, не доверие к сертификату сайта.
     */
    public async verifyIssuedProxyWorks(
        serverHost: string,
        port: number,
        proxyLogin: string,
        proxyPassword: string,
        attempts: number = 4,
    ): Promise<boolean> {
        const proxyUrl = `http://${encodeURIComponent(proxyLogin)}:${encodeURIComponent(proxyPassword)}@${serverHost}:${port}`;
        const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });
        const timeoutMs = 25000;
        const verifyUrl = this.getProxyHealthVerifyUrl();

        // Апстримы (особенно резидентские) флаки: один запрос может отвалиться по таймауту,
        // хотя прокси живой. Ретраим несколько раз — успех хотя бы раз = прокси рабочий.
        // Иначе единичный блип апстрима навсегда суспендил бы рабочий прокси.
        for (let i = 0; i < attempts; i++) {
            try {
                this.logger.log("SYSTEM", `🔍 Проверка прокси HTTP (${i + 1}/${attempts}): GET ${verifyUrl} через ${serverHost}:${port}`, undefined);
                const res = await axios.get(verifyUrl, {
                    httpsAgent: agent,
                    proxy: false,
                    timeout: timeoutMs,
                    validateStatus: () => true,
                    maxRedirects: 5,
                    responseType: "text",
                    headers: { "User-Agent": "ShadowProxy-HealthCheck/1.0" },
                });
                const body = typeof res.data === "string" ? res.data.trim().toLowerCase() : "";
                if (res.status === 200 && body === "ok") {
                    this.logger.log("SYSTEM", `✅ Прокси ответил (${res.status}), тело ok`, undefined);
                    return true;
                }
                this.logger.log(
                    "SYSTEM",
                    `❌ Проверка прокси (${i + 1}/${attempts}): статус ${res.status}, ожидались 200 и тело ok, получено: ${body.slice(0, 120)}`,
                    undefined,
                );
            } catch (err: unknown) {
                const msg = err && typeof err === "object" && "message" in err ? String((err as Error).message) : String(err);
                this.logger.log("SYSTEM", `❌ Проверка прокси (${i + 1}/${attempts}): ${msg}`, undefined);
            }
            if (i < attempts - 1) await sleep(2000);
        }
        return false;
    }

    /**
     * Прокси юзера + история генераций (ТЗ 2.2в) для админ-диалога поддержки.
     * Прокси — из таблицы Proxy; история — из логов действий (USER_ACTION/PROXY_GENERATE).
     */
    async getUserProxiesForAdmin(userId: string, limit: number = 100) {
        const [proxies, genLogs] = await Promise.all([
            this.prisma.proxy.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: limit,
                select: {
                    id: true,
                    type: true,
                    country: true,
                    status: true,
                    rotation: true,
                    serverHost: true,
                    userPort: true,
                    userLogin: true,
                    userPassword: true,
                    trafficUsed: true,
                    createdAt: true,
                    lastActivityAt: true,
                },
            }),
            this.prisma.log.findMany({
                where: { userId, type: LogType.USER_ACTION },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
        ]);

        const generations = genLogs
            .filter((l) => (l.metadata as { actionType?: string })?.actionType === "PROXY_GENERATE")
            .map((l) => {
                const m = (l.metadata || {}) as Record<string, unknown>;
                return {
                    id: l.id,
                    createdAt: l.createdAt,
                    packageType: m.packageType ?? null,
                    quantity: m.quantity ?? null,
                    location: m.location ?? null,
                    rotation: m.rotation ?? null,
                    rotationInterval: m.rotationInterval ?? null,
                };
            });

        return { proxies, generations };
    }

    /**
     * Диагностика прокси для поддержки (ТЗ 2.3): реальный запрос через клиентские
     * креды прокси → отдаём works/exitIp/country/ping. Один прокси, быстрый ответ.
     */
    async checkProxyForSupport(proxyId: string): Promise<{
        works: boolean;
        exitIp: string | null;
        country: string | null;
        pingMs: number | null;
        error: string | null;
    }> {
        const proxy = await this.prisma.proxy.findUnique({ where: { id: proxyId } });
        if (!proxy) throw new NotFoundException("errors.proxy_not_found");

        // Клиентские креды (через наш гейтвей); если их нет — старый прямой формат апстрима.
        const host = proxy.serverHost || proxy.host;
        const port = proxy.userPort || proxy.port;
        const login = proxy.userLogin || proxy.username;
        const password = proxy.userPassword || proxy.password;
        if (!host || !port || !login) {
            return { works: false, exitIp: null, country: null, pingMs: null, error: "нет данных подключения" };
        }

        const proxyUrl = `http://${encodeURIComponent(login)}:${encodeURIComponent(password || "")}@${host}:${port}`;
        const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });

        // 1) exit-IP + ping через api.ipify.org (то же, что делает proxy-test.js)
        const t0 = Date.now();
        let exitIp: string | null = null;
        try {
            const res = await axios.get("https://api.ipify.org", {
                httpsAgent: agent,
                proxy: false,
                timeout: 15000,
                responseType: "text",
                validateStatus: () => true,
                headers: { "User-Agent": "ShadowProxy-SupportChecker/1.0" },
            });
            if (res.status >= 200 && res.status < 400 && typeof res.data === "string") {
                exitIp = res.data.trim().slice(0, 45);
            } else {
                return { works: false, exitIp: null, country: null, pingMs: null, error: `HTTP ${res.status}` };
            }
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "message" in err ? String((err as Error).message) : String(err);
            return { works: false, exitIp: null, country: null, pingMs: null, error: msg.slice(0, 100) };
        }
        const pingMs = Date.now() - t0;

        // 2) страна по exit-IP (ip-api.com — уже используется в auth.service для гео)
        let country: string | null = null;
        if (exitIp) {
            try {
                const geo = await axios.get(`http://ip-api.com/json/${exitIp}?fields=status,country,countryCode`, {
                    timeout: 8000,
                    validateStatus: () => true,
                });
                if (geo.data?.status === "success") {
                    country = geo.data.countryCode ? `${geo.data.country} (${geo.data.countryCode})` : geo.data.country;
                }
            } catch {
                /* гео не критично — прокси всё равно рабочий */
            }
        }

        return { works: true, exitIp, country, pingMs, error: null };
    }
}
