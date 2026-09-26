import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProxyServerService } from "../proxy-server/proxy-server.service";
import { ProxyType, ProxyStatus } from "@prisma/client";
import axios, { AxiosError } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { randomBytes, randomUUID } from "node:crypto";
import {
    ADMIN_PROXY_TEST_TYPES,
    AdminProxyTestTarget,
    CreateProxyTestDto,
} from "./dtos/proxy-test.dto";
import { IspEuProvider } from "../proxy/providers/services/isp-eu.provider";
import { IspUsaProvider } from "../proxy/providers/services/isp-usa.provider";
import { ResidentialLiteProvider } from "../proxy/providers/services/residential-lite.provider";
import { MobileGbProvider } from "../proxy/providers/services/mobile-gb.provider";
import { Proxy922Provider } from "../proxy/providers/services/proxy-922.provider";

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
    mbps: number | null;
    exitIp: string;
    error: string;
    startedAt: string | null;
    finishedAt: string | null;
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
const LATENCY_URL = "https://api.ipify.org";

@Injectable()
export class ProxyTestService {
    private readonly jobs = new Map<string, ProxyTestJob>();
    private activeJobId: string | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly proxyServerService: ProxyServerService,
        private readonly ispEuProvider: IspEuProvider,
        private readonly ispUsaProvider: IspUsaProvider,
        private readonly residentialLiteProvider: ResidentialLiteProvider,
        private readonly mobileGbProvider: MobileGbProvider,
        private readonly proxy922Provider: Proxy922Provider,
    ) {}

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
                safeQaAvailable: ([
                    ProxyType.MOBILE_GB,
                    ProxyType.IPV6_GB,
                    ProxyType.ISP_USA,
                    ProxyType.ISP_EU,
                    ProxyType.RESIDENTIAL_LITE,
                ] as ProxyType[]).includes(type),
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
        void this.execute(job, servers[0].host, servers[0].token, targets).catch((error: unknown) => {
            job.status = "failed";
            job.error = this.safeError(error);
            job.finishedAt = new Date().toISOString();
            this.activeJobId = null;
        });
        return this.publicJob(job);
    }

    getRun(id: string) {
        this.cleanupJobs();
        const job = this.jobs.get(id);
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
            if (type === ProxyType.MOBILE_GB) {
                const geo = requestedCountry || "US";
                const proxy = this.mobileGbProvider.createProxy(geo);
                return this.providerTarget(type, geo, proxy);
            }
            if (type === ProxyType.IPV6_GB) {
                const geo = requestedCountry || "US";
                const proxy = this.proxy922Provider.createProxy(geo);
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
        const queue = [...targets];
        const worker = async () => {
            while (queue.length) {
                const target = queue.shift();
                if (!target) return;
                const result = job.results.find((item) => item.id === target.id);
                if (!result) continue;
                if (!target.upstream) {
                    result.status = "unavailable";
                    result.error = target.unavailableReason || "Тестовый upstream недоступен";
                    result.finishedAt = new Date().toISOString();
                    continue;
                }
                await this.testTarget(job, result, target, gatewayHost, gatewayToken);
            }
        };
        await Promise.all(Array.from({ length: Math.min(job.concurrency, targets.length || 1) }, () => worker()));
        job.status = job.results.some((item) => item.status === "ok") ? "completed" : "failed";
        job.finishedAt = new Date().toISOString();
        this.activeJobId = null;
    }

    private async testTarget(job: ProxyTestJob, result: ProxyTestResult, target: Target, gatewayHost: string, gatewayToken: string) {
        const login = `qa-admin-test-${job.id.slice(0, 8)}-${target.type.toLowerCase()}-${randomBytes(5).toString("hex")}`;
        const password = randomBytes(18).toString("base64url");
        result.status = "running";
        result.startedAt = new Date().toISOString();
        try {
            await axios.post(`http://${gatewayHost}:808/add-port`, {
                port: 10000,
                user_id: "admin-proxy-test",
                login,
                password,
                proxy_host: target.upstream!.host,
                proxy_port: target.upstream!.port,
                proxy_username: target.upstream!.username,
                proxy_password: target.upstream!.password,
            }, { headers: { Authorization: `Bearer ${gatewayToken}` }, timeout: 5000 });

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
            if (stats.inBytes + stats.outBytes < Math.floor(downloaded.bytes * 0.7)) {
                result.status = "failed";
                result.error = "Gateway не подтвердил ожидаемый расход байтов";
            } else {
                result.status = "ok";
            }
        } catch (error: unknown) {
            result.status = "failed";
            result.error = this.safeError(error);
        } finally {
            await axios.post(`http://${gatewayHost}:808/block-login`, { login }, {
                headers: { Authorization: `Bearer ${gatewayToken}` },
                timeout: 5000,
            }).catch(() => undefined);
            result.finishedAt = new Date().toISOString();
        }
    }

    private async measureLatency(agent: HttpsProxyAgent<string>) {
        let best = Number.POSITIVE_INFINITY;
        let exitIp = "";
        for (let i = 0; i < 2; i++) {
            const started = Date.now();
            const response = await axios.get<string>(LATENCY_URL, {
                httpsAgent: agent,
                proxy: false,
                responseType: "text",
                timeout: 15000,
                validateStatus: () => true,
                headers: { "User-Agent": "ShadowProxy-Admin-Tester/1.0" },
            });
            if (response.status < 200 || response.status >= 400) throw new Error(`latency HTTP ${response.status}`);
            best = Math.min(best, Date.now() - started);
            if (!exitIp) exitIp = String(response.data).trim().slice(0, 45);
        }
        return { ms: Number.isFinite(best) ? best : null, exitIp };
    }

    private async measureDownload(agent: HttpsProxyAgent<string>, sizeMb: number) {
        const bytesToDownload = Math.round(sizeMb * 1_000_000);
        const started = Date.now();
        const response = await axios.get<ArrayBuffer>(`${DOWNLOAD_BASE_URL}${bytesToDownload}`, {
            httpsAgent: agent,
            proxy: false,
            responseType: "arraybuffer",
            timeout: 90000,
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
        for (let i = 0; i < 12; i++) {
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
            if (latest.inBytes + latest.outBytes >= Math.floor(minimumBytes * 0.7)) return latest;
            await new Promise((resolve) => setTimeout(resolve, 250));
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
            status: target.upstream ? "pending" : "unavailable",
            latencyMs: null,
            downloadedBytes: 0,
            gatewayInBytes: 0,
            gatewayOutBytes: 0,
            gatewayReportedBytes: 0,
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
            results: job.results.map((result) => ({ ...result })),
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
            if (error.code) return error.code;
        }
        if (error instanceof Error) return error.message.replace(/https?:\/\/[^\s]+/g, "upstream").slice(0, 180);
        return String(error).slice(0, 180);
    }
}
