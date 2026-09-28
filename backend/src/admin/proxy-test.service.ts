import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ProxyServerService } from "../proxy-server/proxy-server.service";
import { Prisma, ProxyType, ProxyStatus } from "@prisma/client";
import axios, { AxiosError } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "argon2";
import { ADMIN_PROXY_TEST_TYPES, AdminProxyTestTarget, CreateProxyTestDto } from "./dtos/proxy-test.dto";
import { IspEuProvider } from "../proxy/providers/services/isp-eu.provider";
import { IspUsaProvider } from "../proxy/providers/services/isp-usa.provider";
import { ResidentialLiteProvider } from "../proxy/providers/services/residential-lite.provider";
import { ProxyEmpireProvider } from "../proxy/providers/services/proxy-empire.provider";

type Upstream = {
    host: string;
    port: number;
    username: string;
    password: string;
};

type Target = {
    id: string;
    type: ProxyType;
    label: string;
    country: string;
    source: "provider" | "database";
    upstream?: Upstream;
    proxyEmpireType?: "mobile" | "residential";
    unavailableReason?: string;
};

type ProxyTestResult = {
    id: string;
    type: ProxyType;
    label: string;
    country: string;
    source: "provider" | "database";
    status: "pending" | "running" | "ok" | "failed" | "unavailable";
    latencyMs: number | null;
    downloadedBytes: number;
    gatewayInBytes: number;
    gatewayOutBytes: number;
    gatewayReportedBytes: number;
    billedBytes: number | null;
    billingVerified: boolean | null;
    mbps: number | null;
    exitIp: string;
    error: string;
    startedAt: string | null;
    finishedAt: string | null;
};

type BillingProbe = {
    userId: string;
    userPackageId: string;
    proxyId: string;
    trafficField: "premiumTrafficLeft" | "ispUsaTrafficLeft" | "ispEuTrafficLeft" | "residentialLiteTrafficLeft";
    initialBytes: bigint;
};

const BILLING_FIELD_BY_TYPE: Partial<Record<ProxyType, BillingProbe["trafficField"]>> = {
    RESIDENT_PREMIUM: "premiumTrafficLeft",
    ISP_USA: "ispUsaTrafficLeft",
    ISP_EU: "ispEuTrafficLeft",
    RESIDENTIAL_LITE: "residentialLiteTrafficLeft",
};

type ProxyTestJob = {
    id: string;
    status: "queued" | "running" | "completed" | "failed";
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    target: AdminProxyTestTarget;
    country: string | null;
    sizeMb: number;
    samplesPerTariff: number;
    concurrency: number;
    gatewayHost: string;
    results: ProxyTestResult[];
    error: string;
};

const LABELS: Record<ProxyType, string> = {
    RESIDENT: "Residential (legacy)",
    RESIDENT_PREMIUM: "Residential Proxy",
    MOBILE: "Premium Mobile",
    MOBILE_GB: "Mobile GB",
    IPV6_GB: "IPv6",
    PREMIUM_RESIDENTIAL: "Premium Residential",
    ISP_USA: "ISP USA",
    ISP_EU: "ISP Netherlands",
    RESIDENTIAL_LITE: "Residential Lite",
};

const MAX_JOB_AGE_MS = 60 * 60 * 1000;
const DOWNLOAD_BASE_URL = "https://speed.cloudflare.com/__down?bytes=";
const LATENCY_URLS = ["https://api.ipify.org", "https://ifconfig.me/ip"] as const;
const LATENCY_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const GATEWAY_STATS_WAIT_MS = 15_000;
const GATEWAY_STATS_POLL_MS = 500;
const DIRECT_PROVIDER_TEST_TYPES = new Set<ProxyType>([ProxyType.MOBILE, ProxyType.PREMIUM_RESIDENTIAL, ProxyType.ISP_USA, ProxyType.ISP_EU, ProxyType.RESIDENTIAL_LITE]);

@Injectable()
export class ProxyTestService implements OnModuleInit {
    private readonly jobs = new Map<string, ProxyTestJob>();
    private activeJobId: string | null = null;
    private readonly logger = new Logger(ProxyTestService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly proxyServerService: ProxyServerService,
        private readonly ispEuProvider: IspEuProvider,
        private readonly ispUsaProvider: IspUsaProvider,
        private readonly residentialLiteProvider: ResidentialLiteProvider,
        private readonly proxyEmpireProvider: ProxyEmpireProvider,
    ) {}

    async onModuleInit() {
        // A running job cannot be resumed safely after a backend restart because
        // its temporary gateway logins are intentionally destroyed at the end
        // of every sample. Mark it explicitly instead of leaving the UI stuck
        // forever in a phantom "running" state.
        await this.prisma.proxyTestRun.updateMany({
            where: { status: { in: ["queued", "running"] } },
            data: {
                status: "failed",
                finishedAt: new Date(),
                error: "Backend был перезапущен до завершения проверки",
            },
        });
        await this.cleanupStaleBillingProbes();
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async pruneTrafficBatchReceipts() {
        await this.prisma.proxyTrafficBatchReceipt.deleteMany({
            where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        });
    }

    private async cleanupStaleBillingProbes() {
        const users = await this.prisma.user.findMany({
            where: { email: { startsWith: "qa-", endsWith: "@proxy-test.invalid" } },
            select: { id: true },
        });
        if (users.length === 0) return;
        const userIds = users.map(({ id }) => id);
        const proxies = await this.prisma.proxy.findMany({
            where: { userId: { in: userIds } },
            select: { id: true, serverHost: true, userLogin: true },
        });
        for (const proxy of proxies) {
            if (!proxy.serverHost || !proxy.userLogin) continue;
            const server = await this.prisma.proxyServer.findFirst({ where: { host: proxy.serverHost }, select: { token: true } });
            if (server?.token) {
                await this.proxyServerService.blockLoginOnServer(proxy.serverHost, proxy.userLogin, server.token).catch(() => undefined);
            }
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.proxy.deleteMany({ where: { userId: { in: userIds } } });
            await tx.user.deleteMany({ where: { id: { in: userIds } } });
        });
    }

    async getCatalog() {
        const counts = await this.prisma.proxy.groupBy({
            by: ["type"],
            where: { status: ProxyStatus.ACTIVE },
            _count: { _all: true },
        });
        const countByType = new Map(counts.map((item) => [item.type, item._count._all]));
        return {
            balanceImpact: "none",
            defaultSizeMb: 1,
            maxSizeMb: 25,
            types: ADMIN_PROXY_TEST_TYPES.map((type) => ({
                type,
                label: LABELS[type],
                activeProxyCount: countByType.get(type) ?? 0,
                safeQaAvailable: DIRECT_PROVIDER_TEST_TYPES.has(type) || (countByType.get(type) ?? 0) > 0,
            })),
        };
    }

    async createRun(dto: CreateProxyTestDto) {
        this.cleanupJobs();
        if (this.activeJobId) {
            throw new ConflictException("Проверка уже выполняется. Дождитесь завершения текущего прогона.");
        }

        const servers = await this.prisma.proxyServer.findMany({
            where: { status: "ACTIVE", token: { not: null } },
            select: { host: true, token: true },
        });
        if (servers.length !== 1 || !servers[0].token) {
            throw new BadRequestException(`Для теста нужна ровно одна ACTIVE gateway-нода с токеном (сейчас ${servers.length})`);
        }

        const normalized = {
            target: dto.target ?? "ALL",
            country: dto.country?.trim().toUpperCase() || null,
            samplesPerTariff: dto.samplesPerTariff ?? 1,
            sizeMb: dto.sizeMb ?? 1,
            concurrency: dto.concurrency ?? 2,
        };
        const targets = await this.buildTargets(normalized.target, normalized.country, normalized.samplesPerTariff);
        const results = targets.map((target) => this.toInitialResult(target));
        const id = randomUUID();
        const job: ProxyTestJob = {
            id,
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            target: normalized.target,
            country: normalized.country,
            sizeMb: normalized.sizeMb,
            samplesPerTariff: normalized.samplesPerTariff,
            concurrency: normalized.concurrency,
            gatewayHost: this.proxyServerService.getPublicHost(servers[0].host),
            results,
            error: "",
        };
        this.jobs.set(id, job);
        this.activeJobId = id;
        await this.persistJob(job);
        void this.execute(job, servers[0].host, servers[0].token, targets).catch((error: unknown) => {
            job.status = "failed";
            job.error = this.safeError(error);
            job.finishedAt = new Date().toISOString();
            this.activeJobId = null;
            void this.persistJob(job).catch((persistError: unknown) => {
                this.logger.error(`Не удалось сохранить результат проверки ${job.id}: ${this.safeError(persistError)}`);
            });
        });
        return this.publicJob(job);
    }

    async getCurrentRun() {
        this.cleanupJobs();

        const activeJob = [...this.jobs.values()].find((job) => job.status === "queued" || job.status === "running");
        if (activeJob) return this.publicJob(activeJob);

        const record = await this.prisma.proxyTestRun.findFirst({
            where: { createdAt: { gte: new Date(Date.now() - MAX_JOB_AGE_MS) } },
            orderBy: { createdAt: "desc" },
        });
        return record ? this.publicJob(this.jobFromRecord(record)) : null;
    }

    async getRun(id: string) {
        this.cleanupJobs();
        let job = this.jobs.get(id);
        if (!job) {
            const record = await this.prisma.proxyTestRun.findUnique({ where: { id } });
            if (record) {
                job = this.jobFromRecord(record);
                this.jobs.set(job.id, job);
            }
        }
        if (!job) throw new NotFoundException("Результат проверки не найден или уже истёк");
        return this.publicJob(job);
    }

    private async buildTargets(target: AdminProxyTestTarget, country: string | null, samplesPerTariff: number): Promise<Target[]> {
        const types = target === "ALL" ? [...ADMIN_PROXY_TEST_TYPES] : [target as ProxyType];
        const targets: Target[] = [];

        for (const type of types) {
            const providerTarget = this.buildProviderTarget(type, country);
            if (providerTarget) {
                targets.push(providerTarget);
                continue;
            }

            const proxies = await this.prisma.proxy.findMany({
                where: {
                    type,
                    status: ProxyStatus.ACTIVE,
                    ...(country ? { country } : {}),
                },
                orderBy: { updatedAt: "desc" },
                take: samplesPerTariff,
                select: { id: true, type: true, country: true, host: true, port: true, username: true, password: true },
            });

            if (!proxies.length) {
                targets.push({
                    id: `${type}-unavailable`,
                    type,
                    label: LABELS[type],
                    country: country || "—",
                    source: "database",
                    unavailableReason: "Нет ACTIVE-прокси этого тарифа для безопасного QA-прогона",
                });
                continue;
            }

            for (const proxy of proxies) {
                targets.push({
                    id: proxy.id,
                    type: proxy.type,
                    label: LABELS[proxy.type],
                    country: proxy.country || "—",
                    source: "database",
                    upstream: {
                        host: proxy.host,
                        port: proxy.port,
                        username: proxy.username,
                        password: proxy.password,
                    },
                });
            }
        }

        return targets;
    }

    private buildProviderTarget(type: ProxyType, requestedCountry: string | null): Target | null {
        try {
            if (type === ProxyType.MOBILE || type === ProxyType.PREMIUM_RESIDENTIAL) {
                const country = requestedCountry || "US";
                return {
                    id: `provider-${type}`,
                    type,
                    label: LABELS[type],
                    country,
                    source: "provider",
                    proxyEmpireType: type === ProxyType.MOBILE ? "mobile" : "residential",
                };
            }
            if (type === ProxyType.ISP_EU) {
                const proxy = this.ispEuProvider.createProxy("NL");
                return this.providerTarget(type, "NL", proxy);
            }
            if (type === ProxyType.ISP_USA) {
                const proxy = this.ispUsaProvider.createProxy();
                return this.providerTarget(type, "US", proxy);
            }
            if (type === ProxyType.RESIDENTIAL_LITE) {
                const geo = requestedCountry || "US";
                const proxy = this.residentialLiteProvider.createProxy(geo);
                return this.providerTarget(type, geo, proxy);
            }
        } catch (error: unknown) {
            return {
                id: `${type}-unavailable`,
                type,
                label: LABELS[type],
                country: requestedCountry || "—",
                source: "provider",
                unavailableReason: this.safeError(error),
            };
        }
        return null;
    }

    private providerTarget(type: ProxyType, country: string, proxy: Upstream): Target {
        return {
            id: `provider-${type}`,
            type,
            label: LABELS[type],
            country,
            source: "provider",
            upstream: proxy,
        };
    }

    private async execute(job: ProxyTestJob, gatewayHost: string, gatewayToken: string, targets: Target[]) {
        job.status = "running";
        job.startedAt = new Date().toISOString();
        await this.persistJob(job);
        const queue = [...targets];
        const worker = async () => {
            while (queue.length) {
                const target = queue.shift();
                if (!target) return;
                const result = job.results.find((item) => item.id === target.id);
                if (!result) continue;
                if (!target.upstream && !target.proxyEmpireType) {
                    result.status = "unavailable";
                    result.error = target.unavailableReason || "Тестовый upstream недоступен";
                    result.finishedAt = new Date().toISOString();
                    await this.persistJob(job);
                    continue;
                }
                await this.testTarget(job, result, target, gatewayHost, gatewayToken);
            }
        };
        await Promise.all(Array.from({ length: Math.min(job.concurrency, targets.length || 1) }, () => worker()));
        job.status = job.results.length > 0 && job.results.every((item) => item.status === "ok") ? "completed" : "failed";
        job.finishedAt = new Date().toISOString();
        this.activeJobId = null;
        await this.persistJob(job);
    }

    private async testTarget(job: ProxyTestJob, result: ProxyTestResult, target: Target, gatewayHost: string, gatewayToken: string) {
        const login = `qa-admin-test-${job.id.slice(0, 8)}-${target.type.toLowerCase()}-${randomBytes(5).toString("hex")}`;
        const password = randomBytes(18).toString("base64url");
        result.status = "running";
        result.startedAt = new Date().toISOString();
        await this.persistJob(job);
        let billingProbe: BillingProbe | null = null;
        let gatewayPortAdded = false;
        try {
            let upstream = target.upstream;
            if (target.proxyEmpireType) {
                const proxies = await this.proxyEmpireProvider.generateProxyList({
                    proxyType: target.proxyEmpireType,
                    country: target.country,
                    length: 100,
                });
                upstream = proxies[0];
                if (!upstream) throw new Error("ProxyEmpire не вернул тестовый upstream");
            }
            if (!upstream) throw new Error("Для тарифа не настроен тестовый upstream");

            billingProbe = await this.createBillingProbe(target, login, password, gatewayHost, upstream, job.sizeMb);

            await axios.post(
                `http://${gatewayHost}:808/add-port`,
                {
                    port: 10000,
                    user_id: "admin-proxy-test",
                    login,
                    password,
                    proxy_host: upstream.host,
                    proxy_port: upstream.port,
                    proxy_username: upstream.username,
                    proxy_password: upstream.password,
                },
                { headers: { Authorization: `Bearer ${gatewayToken}` }, timeout: 5000 },
            );
            gatewayPortAdded = true;

            const proxyUrl = `http://${encodeURIComponent(login)}:${encodeURIComponent(password)}@${gatewayHost}:10000`;
            const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });
            const latency = await this.measureLatency(agent);
            const downloaded = await this.measureDownload(agent, job.sizeMb);
            const stats = await this.waitForGatewayStats(gatewayHost, gatewayToken, login, downloaded.bytes);

            result.latencyMs = latency.ms;
            result.exitIp = latency.exitIp;
            result.downloadedBytes = downloaded.bytes;
            result.mbps = downloaded.mbps;
            result.gatewayInBytes = stats.inBytes;
            result.gatewayOutBytes = stats.outBytes;
            result.gatewayReportedBytes = stats.reportedInBytes + stats.reportedOutBytes;
            const minimumBytes = Math.floor(downloaded.bytes * 0.7);
            if (stats.inBytes + stats.outBytes < minimumBytes) {
                result.status = "failed";
                result.error = "Gateway не учёл ожидаемый объём трафика";
            } else if (result.gatewayReportedBytes < minimumBytes) {
                result.status = "failed";
                result.error = "Backend не подтвердил batch-отчёт gateway";
            } else if (billingProbe) {
                const account = await this.prisma.user.findUnique({
                    where: { id: billingProbe.userId },
                    select: { [billingProbe.trafficField]: true },
                });
                if (!account) throw new Error("QA-баланс не найден после трафик-отчёта");
                const remaining = BigInt(String((account as Record<string, unknown>)[billingProbe.trafficField] ?? "0"));
                const debited = billingProbe.initialBytes - remaining;
                result.billedBytes = Number(debited);
                result.billingVerified = debited === BigInt(result.gatewayReportedBytes) && debited > 0n;
                if (!result.billingVerified) {
                    result.status = "failed";
                    result.error = `Списание не совпало с подтверждённым gateway-трафиком (${debited} / ${result.gatewayReportedBytes} байт)`;
                } else {
                    result.status = "ok";
                }
            } else {
                result.status = "ok";
            }
        } catch (error: unknown) {
            result.status = "failed";
            result.error = this.safeError(error);
        } finally {
            if (gatewayPortAdded) {
                await axios
                    .post(
                        `http://${gatewayHost}:808/block-login`,
                        { login },
                        {
                            headers: { Authorization: `Bearer ${gatewayToken}` },
                            timeout: 5000,
                        },
                    )
                    .catch(() => undefined);
            }
            if (billingProbe)
                await this.deleteBillingProbe(billingProbe).catch((error: unknown) => {
                    this.logger.error(`Не удалось удалить временную QA-запись: ${this.safeError(error)}`);
                });
            result.finishedAt = new Date().toISOString();
            await this.persistJob(job).catch((error: unknown) => {
                this.logger.error(`Не удалось сохранить результат образца ${result.id}: ${this.safeError(error)}`);
            });
        }
    }

    private async createBillingProbe(target: Target, login: string, password: string, serverHost: string, upstream: Upstream, sizeMb: number): Promise<BillingProbe | null> {
        const trafficField = BILLING_FIELD_BY_TYPE[target.type];
        if (!trafficField) return null;

        const userId = randomUUID();
        const userPackageId = randomUUID();
        const proxyId = randomUUID();
        const initialBytes = BigInt(Math.ceil(sizeMb * 1_000_000 + 2_000_000));
        const userTrafficFieldByProxyField = {
            premiumTrafficLeft: "premiumTrafficLeft",
            ispUsaTrafficLeft: "ispUsaTrafficLeft",
            ispEuTrafficLeft: "ispEuTrafficLeft",
            residentialLiteTrafficLeft: "residentialLiteTrafficLeft",
        } as const;
        const region = target.country === "US" ? "USA" : ["NL", "GB", "DE", "FR", "ES", "IT"].includes(target.country) ? "EUROPE" : "CIS";

        await this.prisma.$transaction(async (tx) => {
            await tx.user.create({
                data: {
                    id: userId,
                    email: `qa-${userId}@proxy-test.invalid`,
                    password: await hash(randomBytes(24).toString("base64url")),
                    authMethod: "CREDENTIALS",
                    region,
                    [userTrafficFieldByProxyField[trafficField]]: initialBytes.toString(),
                },
            });
            await tx.userPackage.create({ data: { id: userPackageId, userId, type: target.type } });
            await tx.proxy.create({
                data: {
                    id: proxyId,
                    host: upstream.host,
                    port: upstream.port,
                    username: upstream.username,
                    password: upstream.password,
                    type: target.type,
                    country: target.country,
                    rotation: "BY_REQUEST",
                    userId,
                    userPackageId,
                    serverHost,
                    userPort: 10000,
                    userLogin: login,
                    userPassword: password,
                    status: ProxyStatus.ACTIVE,
                },
            });
        });
        return { userId, userPackageId, proxyId, trafficField, initialBytes };
    }

    private async deleteBillingProbe(probe: BillingProbe) {
        await this.prisma.$transaction(async (tx) => {
            await tx.proxy.deleteMany({ where: { id: probe.proxyId } });
            await tx.userPackage.deleteMany({ where: { id: probe.userPackageId } });
            await tx.user.deleteMany({ where: { id: probe.userId } });
        });
    }

    private async measureLatency(agent: HttpsProxyAgent<string>) {
        let lastError: unknown;
        for (const url of LATENCY_URLS) {
            let best = Number.POSITIVE_INFINITY;
            let exitIp = "";
            let success = false;
            for (let i = 0; i < 2; i++) {
                const started = Date.now();
                try {
                    const response = await axios.get<string>(url, {
                        httpsAgent: agent,
                        proxy: false,
                        responseType: "text",
                        timeout: LATENCY_TIMEOUT_MS,
                        validateStatus: () => true,
                        headers: { "User-Agent": "ShadowProxy-Admin-Tester/1.0" },
                    });
                    if (response.status < 200 || response.status >= 400) {
                        throw new Error(`latency HTTP ${response.status}`);
                    }
                    best = Math.min(best, Date.now() - started);
                    if (!exitIp) exitIp = String(response.data).trim().slice(0, 45);
                    success = true;
                } catch (error: unknown) {
                    lastError = error;
                    break;
                }
            }
            if (success) return { ms: Number.isFinite(best) ? best : null, exitIp };
        }
        throw lastError ?? new Error("Не удалось определить внешний IP через прокси");
    }

    private async measureDownload(agent: HttpsProxyAgent<string>, sizeMb: number) {
        const bytesToDownload = Math.round(sizeMb * 1_000_000);
        const started = Date.now();
        const response = await axios.get<ArrayBuffer>(`${DOWNLOAD_BASE_URL}${bytesToDownload}`, {
            httpsAgent: agent,
            proxy: false,
            responseType: "arraybuffer",
            timeout: DOWNLOAD_TIMEOUT_MS,
            maxContentLength: 30 * 1_000_000,
            maxBodyLength: 30 * 1_000_000,
            maxRedirects: 3,
            validateStatus: () => true,
            headers: { "User-Agent": "ShadowProxy-Admin-Tester/1.0" },
        });
        if (response.status < 200 || response.status >= 400) throw new Error(`download HTTP ${response.status}`);
        const bytes = response.data.byteLength;
        const seconds = Math.max((Date.now() - started) / 1000, 0.001);
        return { bytes, mbps: Number(((bytes * 8) / seconds / 1_000_000).toFixed(2)) };
    }

    private async waitForGatewayStats(host: string, token: string, login: string, minimumBytes: number) {
        let latest = { inBytes: 0, outBytes: 0, reportedInBytes: 0, reportedOutBytes: 0 };
        const attempts = Math.ceil(GATEWAY_STATS_WAIT_MS / GATEWAY_STATS_POLL_MS);
        for (let i = 0; i < attempts; i++) {
            const response = await axios.get<{
                in_bytes?: number;
                out_bytes?: number;
                reported_in_bytes?: number;
                reported_out_bytes?: number;
            }>(`http://${host}:808/traffic-stats`, {
                params: { login },
                headers: { Authorization: `Bearer ${token}` },
                timeout: 3000,
            });
            latest = {
                inBytes: Number(response.data.in_bytes || 0),
                outBytes: Number(response.data.out_bytes || 0),
                reportedInBytes: Number(response.data.reported_in_bytes || 0),
                reportedOutBytes: Number(response.data.reported_out_bytes || 0),
            };
            const threshold = Math.floor(minimumBytes * 0.7);
            if (latest.inBytes + latest.outBytes >= threshold && latest.reportedInBytes + latest.reportedOutBytes >= threshold) return latest;
            await new Promise((resolve) => setTimeout(resolve, GATEWAY_STATS_POLL_MS));
        }
        return latest;
    }

    private toInitialResult(target: Target): ProxyTestResult {
        return {
            id: target.id,
            type: target.type,
            label: target.label,
            country: target.country,
            source: target.source,
            status: target.upstream || target.proxyEmpireType ? "pending" : "unavailable",
            latencyMs: null,
            downloadedBytes: 0,
            gatewayInBytes: 0,
            gatewayOutBytes: 0,
            gatewayReportedBytes: 0,
            billedBytes: null,
            billingVerified: null,
            mbps: null,
            exitIp: "",
            error: target.unavailableReason || "",
            startedAt: null,
            finishedAt: null,
        };
    }

    private publicJob(job: ProxyTestJob) {
        return {
            ...job,
            results: job.results.map((result) => ({ ...result, billedBytes: result.billedBytes ?? null, billingVerified: result.billingVerified ?? null })),
        };
    }

    private async persistJob(job: ProxyTestJob) {
        const data = {
            status: job.status,
            createdAt: new Date(job.createdAt),
            startedAt: job.startedAt ? new Date(job.startedAt) : null,
            finishedAt: job.finishedAt ? new Date(job.finishedAt) : null,
            target: job.target,
            country: job.country,
            sizeMb: job.sizeMb,
            samplesPerTariff: job.samplesPerTariff,
            concurrency: job.concurrency,
            gatewayHost: job.gatewayHost,
            results: job.results as unknown as Prisma.InputJsonValue,
            error: job.error,
        };

        await this.prisma.proxyTestRun.upsert({
            where: { id: job.id },
            create: { id: job.id, ...data },
            update: data,
        });
    }

    private jobFromRecord(record: {
        id: string;
        status: string;
        createdAt: Date;
        startedAt: Date | null;
        finishedAt: Date | null;
        target: string;
        country: string | null;
        sizeMb: number;
        samplesPerTariff: number;
        concurrency: number;
        gatewayHost: string;
        results: Prisma.JsonValue;
        error: string;
    }): ProxyTestJob {
        const results = Array.isArray(record.results)
            ? (record.results as unknown as ProxyTestResult[]).map((result) => ({ ...result, billedBytes: result.billedBytes ?? null, billingVerified: result.billingVerified ?? null }))
            : [];
        return {
            id: record.id,
            status: record.status as ProxyTestJob["status"],
            createdAt: record.createdAt.toISOString(),
            startedAt: record.startedAt?.toISOString() ?? null,
            finishedAt: record.finishedAt?.toISOString() ?? null,
            target: record.target as AdminProxyTestTarget,
            country: record.country,
            sizeMb: record.sizeMb,
            samplesPerTariff: record.samplesPerTariff,
            concurrency: record.concurrency,
            gatewayHost: record.gatewayHost,
            results,
            error: record.error,
        };
    }

    private cleanupJobs() {
        const cutoff = Date.now() - MAX_JOB_AGE_MS;
        for (const [id, job] of this.jobs) {
            if (job.status !== "queued" && job.status !== "running" && new Date(job.finishedAt || job.createdAt).getTime() < cutoff) {
                this.jobs.delete(id);
            }
        }
    }

    private safeError(error: unknown) {
        if (error instanceof AxiosError) {
            if (error.response?.status) return `HTTP ${error.response.status}`;
            if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return "Тайм-аут при обращении к апстриму";
            if (error.code) return error.code;
        }
        if (error instanceof Error) return error.message.replace(/https?:\/\/[^\s]+/g, "upstream").slice(0, 180);
        return String(error).slice(0, 180);
    }
}
