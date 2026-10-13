import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import axios, { AxiosInstance } from "axios";
import { LoggerService } from "../../../logger/logger.service";
import { resolveHost } from "../../../shared/utils/resolve-host";

interface ProxyEmpireProxyListResponse {
    message?: string;
    count?: number;
    proxies?: string[];
    // Older API responses nested the list in `data`; the current v2 endpoint
    // returns `proxies` at the top level.
    data?: {
        proxies?: string[];
        proxy_list?: string;
    };
}

interface ProxyEmpireCountriesResponse {
    countries: { name: string; code: string }[];
}

interface ProxyEmpireUserBandwidth {
    proxy_username: string;
    proxy_password: string;
    bandwidth: {
        total: number;
        used: number;
        remaining: number;
    };
}

interface ProxyEmpireUserResponse {
    data: {
        residential: ProxyEmpireUserBandwidth;
        mobile: ProxyEmpireUserBandwidth;
        datacenter: ProxyEmpireUserBandwidth;
        "static-resi": ProxyEmpireUserBandwidth;
    };
    message: string;
}

export interface ProxyEmpireCredentials {
    host: string;
    port: number;
    username: string;
    password: string;
}

export interface ProxyEmpireSubUserCreated {
    apiToken: string;
    email: string;
}

@Injectable()
export class ProxyEmpireProvider implements OnModuleInit {
    private readonly api: AxiosInstance;
    private readonly subUserInfoFailures = new Map<string, { reason: string; loggedAt: number }>();
    private resolvedHost: string = "v2.proxyempire.io";

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: LoggerService,
    ) {
        this.api = axios.create({
            baseURL: "https://panel.proxyempire.io/api/v2",
            timeout: 10000,
            headers: {
                Authorization: `Bearer ${configService.get<string>("PROXYEMPIRE_API_KEY", "")}`,
            },
        });
    }

    async onModuleInit() {
        await this.refreshResolvedHost();
    }

    /**
     * Перерезолв DNS v2.proxyempire.io → IP. Запускается на старте и каждый час по cron'у,
     * чтобы при смене A-записи провайдера не пришлось рестартить контейнер.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async refreshResolvedHost() {
        const fresh = await resolveHost("v2.proxyempire.io");
        if (!fresh) return;
        if (this.resolvedHost === "v2.proxyempire.io") {
            this.resolvedHost = fresh;
            await this.logger.log("SYSTEM", `ProxyEmpire host resolved: v2.proxyempire.io → ${fresh}`);
        } else if (fresh !== this.resolvedHost) {
            const prev = this.resolvedHost;
            this.resolvedHost = fresh;
            await this.logger.log("SYSTEM", `ProxyEmpire host changed: ${prev} → ${fresh}`);
        }
    }

    async generateProxyList(options: {
        proxyType?: "residential" | "mobile" | "datacenter";
        country?: string;
        region?: string;
        city?: string;
        isp?: string;
        length?: number;
        ipRotationType?: "random" | "sticky" | "custom";
        sessionLifetime?: number;
        apiTokenOverride?: string;
    }): Promise<ProxyEmpireCredentials[]> {
        const { proxyType = "residential", country, region, city, isp, length = 100, ipRotationType, sessionLifetime, apiTokenOverride } = options;
        const safeLength = Math.max(100, Math.min(length, 3000));

        const res = await this.api.post<ProxyEmpireProxyListResponse>("/proxy-list", {
            proxy_type: proxyType,
            ...(country ? { country: country.toLowerCase() } : {}),
            ...(region ? { region } : {}),
            ...(city ? { city } : {}),
            ...(isp ? { isp } : {}),
            ...(ipRotationType && proxyType !== "datacenter" ? { ip_rotation_type: ipRotationType } : {}),
            ...(ipRotationType === "custom" && sessionLifetime ? { session_lifetime: sessionLifetime } : {}),
            length: safeLength,
            format: 2, // host:port:username:password
        }, apiTokenOverride ? { headers: { Authorization: `Bearer ${apiTokenOverride}` } } : undefined);

        const proxies = res.data?.proxies ?? res.data?.data?.proxies ?? [];
        const result: ProxyEmpireCredentials[] = [];

        for (const raw of proxies) {
            // ProxyEmpire format=2 currently returns host:port:username:password.
            // Keep compatibility with older username:password:host:port responses.
            const parts = raw.split(":");
            if (parts.length < 4) continue;

            const currentFormatPort = Number(parts[1]);
            const legacyFormatPort = Number(parts[parts.length - 1]);
            const currentFormat = Number.isInteger(currentFormatPort) && currentFormatPort > 0 && currentFormatPort <= 65535;
            const legacyFormat = Number.isInteger(legacyFormatPort) && legacyFormatPort > 0 && legacyFormatPort <= 65535;
            const port = currentFormat ? currentFormatPort : legacyFormatPort;
            const username = currentFormat ? parts[2] : parts[0];
            const password = currentFormat ? parts.slice(3).join(":") : parts.slice(1, parts.length - 2).join(":");
            if ((!currentFormat && !legacyFormat) || !username || !password) continue;

            result.push({
                host: this.resolvedHost,
                port,
                username,
                password,
            });
        }

        return result;
    }

    async getAvailableLocations(): Promise<string[]> {
        try {
            const res = await this.api.get<ProxyEmpireCountriesResponse>("/countries");
            return (res.data?.countries ?? []).map((c) => c.code.toLowerCase());
        } catch (e: unknown) {
            await this.logger.error(`ProxyEmpire: ошибка получения стран: ${String(e)}`);
            return [];
        }
    }

    async getRegions(connectionType: "residential" | "mobile", countryCode: string): Promise<string[]> {
        try {
            const res = await this.api.get<{ regions: string[] }>("/regions", {
                params: { connection_type: connectionType, country_code: countryCode.toLowerCase() },
            });
            return res.data?.regions ?? [];
        } catch (e: unknown) {
            await this.logger.error(`ProxyEmpire: ошибка получения регионов: ${String(e)}`);
            return [];
        }
    }

    async getCities(connectionType: "residential" | "mobile", countryCode: string, region?: string): Promise<string[]> {
        try {
            const res = await this.api.get<{ cities: string[] }>("/cities", {
                params: { connection_type: connectionType, country_code: countryCode.toLowerCase(), ...(region ? { region } : {}) },
            });
            return res.data?.cities ?? [];
        } catch (e: unknown) {
            await this.logger.error(`ProxyEmpire: ошибка получения городов: ${String(e)}`);
            return [];
        }
    }

    async getIsps(connectionType: "residential" | "mobile", countryCode: string, region?: string, city?: string): Promise<string[]> {
        try {
            const res = await this.api.get<{ isps: string[] }>("/isps", {
                params: {
                    connection_type: connectionType,
                    country_code: countryCode.toLowerCase(),
                    ...(region ? { region } : {}),
                    ...(city ? { city } : {}),
                },
            });
            return res.data?.isps ?? [];
        } catch (e: unknown) {
            await this.logger.error(`ProxyEmpire: ошибка получения ISP: ${String(e)}`);
            return [];
        }
    }

    async rotateSession(username: string): Promise<boolean> {
        try {
            const res = await this.api.get<{ data: { status: string } }>("/rotate-session", {
                params: { username },
            });
            return res.data?.data?.status === "ok";
        } catch (e: unknown) {
            await this.logger.error(`ProxyEmpire: ошибка ротации сессии: ${String(e)}`);
            return false;
        }
    }

    async getUserInfo(): Promise<ProxyEmpireUserResponse["data"] | null> {
        try {
            const res = await this.api.get<ProxyEmpireUserResponse>("/user");
            return res.data?.data ?? null;
        } catch (e: unknown) {
            await this.logger.error(`ProxyEmpire: ошибка получения user info: ${String(e)}`);
            return null;
        }
    }

    async createSubUser(email: string, name: string, proxyType: "residential" | "mobile" | "datacenter" = "residential"): Promise<ProxyEmpireSubUserCreated | null> {
        try {
            return await this.doCreateSubUser(email, name, proxyType);
        } catch (e: any) {
            const status = e?.response?.status;
            const body = e?.response?.data;
            const emailErr = body?.errors?.email?.[0] as string | undefined;

            if (status === 422 && emailErr && emailErr.toLowerCase().includes("already been taken")) {
                // Concurrent creation or a lost acknowledgement is not consent
                // to delete an existing provider account and its paid quota.
                await this.logger.error(`ProxyEmpire: sub-user ${email} уже существует; аккаунт и квота сохранены, требуется восстановить его API token`);
                return null;
            }

            await this.logger.error(`ProxyEmpire: ошибка создания sub-user ${email} (status=${status}): ${JSON.stringify(body) || String(e)}`);
            return null;
        }
    }

    private async doCreateSubUser(email: string, name: string, proxyType: "residential" | "mobile" | "datacenter"): Promise<ProxyEmpireSubUserCreated | null> {
        const res = await this.api.post<{ api_token: string; data: unknown; message?: string }>("/subusers", {
            email,
            name: name || email,
            terms: true,
            proxy_type: proxyType,
            bandwidth: 1,
        });
        const apiToken = res.data?.api_token;
        if (!apiToken) {
            await this.logger.error(`ProxyEmpire: создание sub-user (${email}) — нет api_token в ответе`);
            return null;
        }
        await this.logger.log("SYSTEM", `ProxyEmpire: создан sub-user ${email}`);
        return { apiToken, email };
    }

    async addSubUserBandwidth(email: string, proxyType: "residential" | "mobile" | "datacenter", bytes: number): Promise<boolean> {
        try {
            await this.api.put(`/subusers/${encodeURIComponent(email)}`, {
                bandwidth_update: {
                    action: "add",
                    type: proxyType,
                    amount: bytes,
                },
            });
            await this.logger.log("SYSTEM", `ProxyEmpire: добавлено ${bytes} байт (${proxyType}) sub-user'у ${email}`);
            return true;
        } catch (e: any) {
            const status = e?.response?.status;
            const body = e?.response?.data;
            await this.logger.error(`ProxyEmpire: ошибка пополнения sub-user ${email} (status=${status}): ${JSON.stringify(body) || String(e)}`);
            return false;
        }
    }

    async getSubUserInfo(email: string): Promise<{
        residential?: { total: number; used: number; remaining: number };
        mobile?: { total: number; used: number; remaining: number };
        datacenter?: { total: number; used: number; remaining: number };
    } | null> {
        try {
            const res = await this.api.get<{ data: any; message: string }>(`/subusers/${encodeURIComponent(email)}`);
            const data = res.data?.data;
            if (!data) return null;
            const pick = (b: any) => {
                if (!b) return undefined;
                if (b.total == null || b.used == null || b.remaining == null) throw new Error("Incomplete ProxyEmpire bandwidth response");
                const values = [b.total, b.used, b.remaining].map(Number);
                if (values.some(value => !Number.isSafeInteger(value) || value < 0)) {
                    throw new Error("Invalid ProxyEmpire bandwidth response");
                }
                return { total: values[0], used: values[1], remaining: values[2] };
            };
            const counters = {
                residential: pick(data.residential?.bandwidth),
                mobile: pick(data.mobile?.bandwidth),
                datacenter: pick(data.datacenter?.bandwidth),
            };
            this.subUserInfoFailures.delete(email);
            return counters;
        } catch (e: any) {
            // Repeated failures from the same deleted/unavailable sub-user must
            // stay visible without flooding the minute-by-minute quota sync.
            // Keep requests live so recovery is picked up immediately.
            const reason = `${e?.response?.status ?? e?.code ?? "invalid-response"}:${String(e?.response?.data?.message ?? e?.message ?? "unknown")}`;
            const previous = this.subUserInfoFailures.get(email);
            if (!previous || previous.reason !== reason || Date.now() - previous.loggedAt >= 3600000) {
                if (this.subUserInfoFailures.size >= 10000) {
                    const oldest = this.subUserInfoFailures.keys().next().value;
                    if (oldest !== undefined) this.subUserInfoFailures.delete(oldest);
                }
                this.subUserInfoFailures.set(email, { reason, loggedAt: Date.now() });
                await this.logger.error(`ProxyEmpire: ошибка getSubUserInfo ${email} (${reason}); одинаковые ошибки ограничены одной записью в час`);
            }
            return null;
        }
    }

    async setSubUserBandwidth(email: string, proxyType: "residential" | "mobile" | "datacenter", targetBytes: number): Promise<boolean> {
        const info = await this.getSubUserInfo(email);
        if (!info || !Number.isSafeInteger(targetBytes) || targetBytes < 0) return false;
        const currentTotal = info[proxyType]?.total ?? 0;
        const delta = targetBytes - currentTotal;

        if (delta === 0) {
            await this.logger.log("SYSTEM", `ProxyEmpire: квота ${proxyType} sub-user'а ${email} уже = ${targetBytes} байт, пропуск`);
            return true;
        }

        const action = delta > 0 ? "add" : "remove";
        const amount = Math.abs(delta);

        try {
            await this.api.put(`/subusers/${encodeURIComponent(email)}`, {
                bandwidth_update: { action, type: proxyType, amount },
            });
            await this.logger.log(
                "SYSTEM",
                `ProxyEmpire: ${action} ${amount} байт (${proxyType}) sub-user'у ${email} (target=${targetBytes}, было=${currentTotal})`,
            );
            return true;
        } catch (e: any) {
            const status = e?.response?.status;
            const body = e?.response?.data;
            await this.logger.error(
                `ProxyEmpire: ошибка sync квоты sub-user ${email} ${proxyType} (action=${action}, amount=${amount}, status=${status}): ${JSON.stringify(body) || String(e)}`,
            );
            return false;
        }
    }

}
