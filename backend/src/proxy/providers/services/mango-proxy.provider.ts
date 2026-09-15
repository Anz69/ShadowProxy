import { forwardRef, Inject, Injectable, OnModuleInit } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { ConfigService } from "@nestjs/config";
import { UserService } from "../../../user/user.service";
import { generateRandomString } from "../../../shared/utils/generate-random-string";
import { ServerRegion } from "../../types/server-region.type";
import { PackageType, User, UserRegion } from "@prisma/client";
import { LoggerService } from "../../../logger/logger.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { sleep } from "../../../shared/utils/sleep";
import { PrismaService } from "../../../prisma/prisma.service";
import { OnEvent } from "@nestjs/event-emitter";
import { regionToServer } from "../../../shared/utils/region-to-server";
import { ModifyProxiesDto } from "../../dtos/modify-proxies.dto";
import { resolveHost } from "../../../shared/utils/resolve-host";

@Injectable()
export class MangoProxyProvider implements OnModuleInit {
    private readonly mangoProxyApi: AxiosInstance;
    private resolvedMangoHost: string = "p1.mangoproxy.com";
    private readonly ipList: ServerRegion = {
        cis: "p1.mangoproxy.com",
        europe: "p1.mangoproxy.com",
        usa: "p1.mangoproxy.com",
    };

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly logger: LoggerService,
        private readonly prisma: PrismaService,
    ) {
        this.mangoProxyApi = axios.create({
            baseURL: configService.getOrThrow<string>("MANGO_PROXY_BASE_URL"),
        });
        this.mangoProxyApi.interceptors.request.use((config) => {
            config.data = {
                ...config.data,
                app_key: configService.getOrThrow<string>("MANGO_PROXY_API_KEY"),
            };
            return config;
        });
    }

    async onModuleInit() {
        await this.refreshResolvedHost();
    }

    /**
     * SPRINT-1 (Task A): фича-флаг возврата Mango на гейтвей.
     *   MANGO_MODE=gateway (по умолчанию) — Mango идёт через наш прокси-гейтвей,
     *     баланс и трафик считаем строго у себя (TrafficLog). В апстрим Mango за
     *     доливкой трафика и за снапшотом остатка НЕ ходим (убирает первопричину
     *     7.3/8.1/8.2 — синхронные блокирующие вызовы + десинхрон баланса).
     *   MANGO_MODE=api — старое поведение (прямой Mango API), код сохранён под флагом.
     */
    private isGatewayMode(): boolean {
        // ВНИМАНИЕ: дефолт = "api" (старое поведение) НАМЕРЕННО. Переключать в
        // "gateway" можно только когда готовы И оттестированы остальные части
        // спринта 1 — маршрутизация Mango через гейтвей (шаг 3) и учёт баланса по
        // TrafficLog (задача B). Иначе в gateway-режиме трафик RESIDENT_PREMIUM не
        // считается ни снапшотом (выключен здесь), ни гейтвеем (ещё не подключён).
        return this.configService.get<string>("MANGO_MODE", "api") === "gateway";
    }

    /**
     * Перерезолв DNS p1.mangoproxy.com → IP. Запускается на старте и каждый час по cron'у,
     * чтобы при смене A-записи провайдера не пришлось рестартить контейнер.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async refreshResolvedHost() {
        const fresh = await resolveHost("p1.mangoproxy.com");
        if (fresh && fresh !== this.resolvedMangoHost) {
            const prev = this.resolvedMangoHost;
            this.resolvedMangoHost = fresh;
            for (const key of Object.keys(this.ipList) as Array<keyof ServerRegion>) {
                this.ipList[key] = fresh;
            }
            await this.logger.log("SYSTEM", `Mango host changed: p1.mangoproxy.com ${prev} → ${fresh}`);
        } else if (this.resolvedMangoHost === "p1.mangoproxy.com" && fresh) {
            // первый прогон (boot)
            this.resolvedMangoHost = fresh;
            for (const key of Object.keys(this.ipList) as Array<keyof ServerRegion>) {
                this.ipList[key] = fresh;
            }
            await this.logger.log("SYSTEM", `Mango host resolved: p1.mangoproxy.com → ${fresh}`);
        }
    }

    @OnEvent("proxy.create_account")
    async createUser({ userId, type }: { userId: string; type: PackageType }) {
        if (type === "RESIDENT_PREMIUM") {
            const user = await this.userService.findById(userId);
            
            await this.logger.log("SYSTEM", `🔍 Проверка необходимости создания аккаунта Mango для пользователя ${userId}`, userId, {
                hasPremiumUsername: !!user.premiumUsername && user.premiumUsername.length > 0,
                premiumUsername: user.premiumUsername || "пусто",
            });
            
            if (!user.premiumUsername.length) {
                const username = generateRandomString();
                try {
                await this.logger.log("SYSTEM", `📤 Создание пользователя в Mango API: ${username}`, userId);

                const userCreateRes = await this.mangoProxyApi.post<{ code: string; msg: string; ret_data?: any }>("/create_user", {
                    username,
                });

                console.log("=== MANGO API /create_user RESPONSE ===");
                console.log("Status:", userCreateRes.status);
                console.log("Data:", JSON.stringify(userCreateRes.data, null, 2));
                console.log("======================================");

                await this.logger.log("SYSTEM", `📥 Ответ от Mango API /create_user`, userId, {
                    statusCode: userCreateRes.status,
                    responseData: userCreateRes.data,
                });

                    const { account, password } = await this.createProxyAccount(username);

                    if (userCreateRes.status === 201) {
                        await this.logger.log("SYSTEM", `✅ Успешно создан аккаунт Mango Proxy для пользователя ${userId}`, userId, {
                            username,
                            account,
                        });
                        await this.userService.updateById(userId, {
                            premiumUsername: `${username}:${account}:${password}`,
                        });
                    } else {
                        await this.logger.error(`⚠️ Неожиданный статус при создании пользователя: ${userCreateRes.status}`, userId, {
                            status: userCreateRes.status,
                            data: userCreateRes.data,
                        });
                        throw new Error(userCreateRes.data.msg);
                    }
                    return true;
                } catch (e: unknown) {
                    await this.logger.error(`❌ Ошибка при создании аккаунта Mango Proxy для юзера ${userId}`, userId, {
                        error: e,
                        errorMessage: e instanceof Error ? e.message : String(e),
                    });
                    return false;
                }
            } else {
                await this.logger.log("SYSTEM", `ℹ️ Пользователь ${userId} уже имеет аккаунт Mango, пропускаем создание`, userId);
            }
        }
        return true;
    }

async createProxyAccount(username: string) {
    const account = generateRandomString(12);
    const password = generateRandomString(12);
    
    await this.logger.log("SYSTEM", `📤 Создание прокси-аккаунта в Mango API`, undefined, {
        username,
        account,
    });

    const response = await this.mangoProxyApi.post<{
        code: string;
        msg: string;
        ret_data?: any;
    }>("/add_proxy_account", {
        account,
        password,
        username,
    });

    await this.logger.log("SYSTEM", `📥 Ответ от Mango API /add_proxy_account`, undefined, {
        statusCode: response.status,
        responseData: response.data,
    });

    return {
        account,
        password,
    };
}

    /**
     * Создание Mango-прокси.
     *
     * @param country — ISO-2 либо логический "GLOBAL"/"EUROPE"/"ASIA"
     * @param userRegion — глобальная зона
     * @param user — пользователь (из БД)
     * @param rotationTime — время ротации сессии (МИНУТЫ — Mango API ожидает минуты)
     * @param opts.state — код штата/региона (например "ny") → сегмент -st-XX
     * @param opts.city — слаг города (например "newyork") → -city-XX
     * @param opts.asn — ASN провайдера ("AS7922" или "7922") → -asn-ASNNNN
     *
     * Формат username (по docs.mangoproxy.com):
     *   {account}-zone-{cis|custom}-region-{cc}[-st-{state}][-city-{city}][-asn-AS{n}][-session-{id}-sessTime-{min}]
     */
    async createProxy(
        country: string,
        userRegion: UserRegion,
        user: User,
        rotationTime?: number,
        opts?: { state?: string; city?: string; asn?: string },
    ) {
        let [, userAccount, userPassword] = user.premiumUsername.split(":");
        if (!userAccount || !userPassword) {
            const { account, password } = await this.createProxyAccount(user.premiumUsername);
            await this.userService.updateById(user.id, {
                premiumUsername: `${user.premiumUsername}:${account}:${password}`,
            });
            userAccount = account;
            userPassword = password;
        }
        const continentLabels = {
            GLOBAL: "",
            EUROPE: "-region-eu",
            ASIA: "-region-rsa",
        };
        const region = country.length === 2 ? `-region-${country.toLowerCase()}` : (continentLabels[country] as string);

        // state/city: Mango слаги пишет без пробелов/спецсимволов, в нижнем регистре
        const slug = (s: string) =>
            s
                .toLowerCase()
                .trim()
                .replace(/[\s_]+/g, "")
                .replace(/[^a-z0-9]/g, "");

        const stateSeg = opts?.state ? `-st-${slug(opts.state)}` : "";
        const citySeg = opts?.city ? `-city-${slug(opts.city)}` : "";

        // ASN с фронта может прийти как:
        //   "AS7922"
        //   "AS7922 — Comcast Cable" (наш формат из getAsns)
        //   "7922"
        // Извлекаем только числовую часть.
        let asnSeg = "";
        if (opts?.asn) {
            const m = String(opts.asn).match(/(\d+)/);
            if (m) asnSeg = `-asn-AS${m[1]}`;
        }

        const sessSeg = rotationTime
            ? `-session-${generateRandomString(8)}-sessTime-${rotationTime}`
            : "";

        return {
            username: `${userAccount}-zone-${userRegion === "CIS" ? "cis" : "custom"}${region}${stateSeg}${citySeg}${asnSeg}${sessSeg}`,
            password: userPassword,
            host: this.ipList[regionToServer(country)],
            port: 2333,
        };
    }

    /**
     * Location endpoints Mango — по официальной Swagger-документации
     * https://apikuhnadjafarov.mangoproxy.com/api
     *
     * Все 4 endpoint'а:
     *   POST /agent/locations/{countries,regions,cities,asns}
     *   body: { app_key, page, limit }   ← фильтров по country/region НЕТ
     *   response: { data: [...], meta: { ... } }
     *
     * Фильтрацию по странам/регионам/городам делаем НА НАШЕЙ СТОРОНЕ
     * после получения полного списка. Полные списки умеренного размера
     * (страны ~250, регионы ~3000, города ~50k, ASN ~70k) — кешируем в RAM.
     *
     * Поля в ответе:
     *   countries: { id, code, title }
     *   regions:   { id, countryId, region }                     ← без countryCode!
     *   cities:    { id, city, regionId, region, countryCode }
     *   asns:      { id, title, countryCode, code }              ← code уже с префиксом "AS..."
     *
     * ВАЖНО: regions не содержат countryCode, только countryId.
     * Чтобы фильтровать по стране — приходится дернуть countries и сопоставить code↔id.
     */
    private locationsCache: {
        countries?: Array<{ id: number; code: string; title: string }>;
        regions?: Array<{ id: number; countryId: number; region: string }>;
        cities?: Array<{ id: number; city: string; regionId: number; region: string; countryCode: string }>;
        asns?: Array<{ id: number; title: string; countryCode: string; code: string }>;
        ts?: number;
    } = {};

    private static readonly LOCATIONS_TTL_MS = 60 * 60 * 1000; // 1 час

    private async fetchAllPages<T>(path: string, pageSize = 1000): Promise<T[]> {
        const out: T[] = [];
        for (let page = 1; page <= 200; page++) {
            const res = await this.mangoProxyApi.post<{ data: T[]; meta?: { total?: number; lastPage?: number } }>(path, {
                page,
                limit: pageSize,
            });
            const chunk = Array.isArray(res.data?.data) ? res.data.data : [];
            out.push(...chunk);
            if (chunk.length < pageSize) break;
        }
        return out;
    }

    private async loadLocationsOnce() {
        const now = Date.now();
        if (this.locationsCache.ts && now - this.locationsCache.ts < MangoProxyProvider.LOCATIONS_TTL_MS) return;
        try {
            const [countries, regions, cities, asns] = await Promise.all([
                this.fetchAllPages<{ id: number; code: string; title: string }>("/locations/countries"),
                this.fetchAllPages<{ id: number; countryId: number; region: string }>("/locations/regions"),
                this.fetchAllPages<{ id: number; city: string; regionId: number; region: string; countryCode: string }>(
                    "/locations/cities",
                ),
                this.fetchAllPages<{ id: number; title: string; countryCode: string; code: string }>("/locations/asns"),
            ]);
            this.locationsCache = { countries, regions, cities, asns, ts: now };
            await this.logger.log(
                "SYSTEM",
                `Mango locations cache loaded: ${countries.length} countries, ${regions.length} regions, ${cities.length} cities, ${asns.length} ASNs`,
            );
        } catch (e: any) {
            await this.logger.error(`Mango locations cache load failed: ${e?.message || String(e)}`);
        }
    }

    private countryCodeToId(code: string): number | undefined {
        const c = (this.locationsCache.countries || []).find(
            (x) => x.code?.toLowerCase() === code.toLowerCase(),
        );
        return c?.id;
    }

    /** Региона (state) для страны. Возвращает массив имён региона ("California", "Texas", …). */
    async getStates(country: string): Promise<string[]> {
        await this.loadLocationsOnce();
        const cid = this.countryCodeToId(country);
        if (!cid) return [];
        const list = (this.locationsCache.regions || [])
            .filter((r) => r.countryId === cid)
            .map((r) => r.region)
            .filter(Boolean);
        return Array.from(new Set(list)).sort();
    }

    /** Города для страны (опционально фильтрация по региону). */
    async getCities(country: string, state?: string): Promise<string[]> {
        await this.loadLocationsOnce();
        const cc = country.toUpperCase();
        const list = (this.locationsCache.cities || [])
            .filter((c) => c.countryCode?.toUpperCase() === cc)
            .filter((c) => !state || c.region?.toLowerCase() === state.toLowerCase())
            .map((c) => c.city)
            .filter(Boolean);
        return Array.from(new Set(list)).sort();
    }

    /**
     * ASNs для страны. По API ASN не привязаны к региону/городу — фильтр по стране только.
     * Возвращаем коды вида "AS7922 — Comcast Cable" чтобы фронт показывал и название.
     */
    async getAsns(country: string, _state?: string, _city?: string): Promise<string[]> {
        await this.loadLocationsOnce();
        const cc = country.toUpperCase();
        const list = (this.locationsCache.asns || [])
            .filter((a) => a.countryCode?.toUpperCase() === cc)
            .map((a) => a.code + (a.title ? ` — ${a.title}` : ""))
            .filter(Boolean);
        return Array.from(new Set(list)).sort();
    }

    modifyProxy(modifier: Omit<ModifyProxiesDto, "proxies">, username: string) {
        let result = username;

        if (modifier.location) {
            const zoneRegionRegex = /zone-(cis|custom)(?:-region-[a-z]{2,3})?/i;
            const newRegion = `region-${modifier.location.toLowerCase()}`;
            result = result.replace(zoneRegionRegex, (_m, zone) => `zone-${zone}-${newRegion}`);
        }

        if (modifier.rotation) {
            if (modifier.rotation === "AUTO") {
                result = result.replace(/-session-[a-zA-Z0-9]{8}-sessTime-\d+/, "");
            } else if (modifier.rotation === "BY_TIME" && modifier.rotationInterval) {
                const hasSession = /-session-([a-zA-Z0-9]{8})-sessTime-(\d+)/.test(result);
                if (hasSession) {
                    result = result.replace(/-session-([a-zA-Z0-9]{8})-sessTime-(\d+)/, `-session-$1-sessTime-${modifier.rotationInterval}`);
                } else {
                    const sessionId = generateRandomString(8);
                    result += `-session-${sessionId}-sessTime-${modifier.rotationInterval}`;
                }
            }
        }

        return result;
    }

    /** Текст ошибки Mango/HTTP для сопоставления (включая response.data у Axios). */
    private mangoFlowErrorText(e: unknown): string {
        if (axios.isAxiosError(e)) {
            const parts = [e.message];
            const data = e.response?.data;
            if (data && typeof data === "object") {
                const d = data as Record<string, unknown>;
                for (const key of ["message", "msg", "error"] as const) {
                    if (key in d && d[key] != null) parts.push(String(d[key]));
                }
            }
            return parts.join(" ");
        }
        return e instanceof Error ? e.message : String(e);
    }

    private shouldRecreateMangoPremiumAfterFlowError(e: unknown): boolean {
        const text = this.mangoFlowErrorText(e).toLowerCase();
        if (text.includes("master account not found")) return true;
        if (text.includes("agent user was not found")) return true;
        if (text.includes("10001")) return true;
        return false;
    }

    /**
     * Повторная регистрация в Mango по данным из БД (username:account:password) и повтор add_user_flow.
     * Если account/password отсутствуют — создаём прокси-аккаунт и сохраняем в user.premiumUsername.
     */
    private async recreateMangoPremiumFromDbAndRetryAddFlow(userId: string, trafficInMB: number): Promise<boolean> {
        const user = await this.userService.findById(userId);
        if (!user.premiumUsername?.length) return false;

        const segments = user.premiumUsername.split(":");
        const username = segments[0];
        let account = segments[1];
        let password = segments[2];

        try {
            await this.logger.log(
                "SYSTEM",
                `🔄 Mango: пересоздание пользователя/мастер-аккаунта по БД и повтор зачисления flow (${trafficInMB} МБ)`,
                userId,
                { username, hasProxyCreds: !!(account && password) },
            );

            const recreateRes = await this.mangoProxyApi.post<{ code: string; msg: string; ret_data?: any }>("/create_user", {
                username,
            });

            await this.logger.log("SYSTEM", `📥 Ответ Mango /create_user (recovery)`, userId, {
                statusCode: recreateRes.status,
                responseData: recreateRes.data,
            });

            const createOk = recreateRes.status === 201 || recreateRes.data?.code === "1";
            if (!createOk) {
                await this.logger.error(`⚠️ Mango recovery: create_user неуспешен`, userId, {
                    status: recreateRes.status,
                    data: recreateRes.data,
                });
                return false;
            }

            if (account && password) {
                await this.mangoProxyApi.post<{ code: string; msg: string }>("/add_proxy_account", {
                    account,
                    password,
                    username,
                });
            } else {
                const { account: newAcc, password: newPwd } = await this.createProxyAccount(username);
                account = newAcc;
                password = newPwd;
                await this.userService.updateById(userId, {
                    premiumUsername: `${username}:${account}:${password}`,
                });
            }

            await sleep(3000);

            const retryRes = await this.mangoProxyApi.post<{ code: string; msg: string; ret_data?: any }>("/add_user_flow", {
                username,
                flow: trafficInMB,
            });

            await this.logger.log("SYSTEM", `📥 Ответ Mango /add_user_flow (после recovery)`, userId, {
                statusCode: retryRes.status,
                responseData: retryRes.data,
            });

            if (retryRes.data?.code === "1") {
                await this.logger.log("SYSTEM", `✅ После recovery зачислено ${trafficInMB} МБ для ${userId}`, userId);
                return true;
            }
            return false;
        } catch (recoveryErr: unknown) {
            await this.logger.error(`❌ Mango recovery не удался для ${userId}`, userId, {
                error: recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr),
            });
            return false;
        }
    }

    /**
     * Gateway-режим: Mango НЕ отдаёт трафик суб-аккаунту без flow на своей стороне
     * (прямой коннект = http 403). По ТЗ мы не метим через Mango API, но аккаунт нужно
     * РАЗБЛОКИРОВАТЬ — держим на нём большой запас flow (разово + дозаливка при просадке),
     * а реальный лимит юзера считаем у себя на гейтвее. Идемпотентно через /user_info:
     * если остаток уже большой — ничего не делаем (наш учёт Mango-flow не тратит, но
     * реальный трафик через Mango его расходует, поэтому периодически дольём).
     *
     * Флаг MANGO_UNLOCK_ENABLED=false — выключить (напр. если мастер Mango не пополнен).
     */
    async ensureMangoFlow(premiumUsername: string | null | undefined): Promise<void> {
        if (!this.isGatewayMode()) return;
        if (this.configService.get<string>("MANGO_UNLOCK_ENABLED", "true") !== "true") return;
        const username = (premiumUsername || "").split(":")[0];
        if (!username) return;

        const thresholdMb = Number(this.configService.get<string>("MANGO_UNLOCK_THRESHOLD_MB", "1000"));
        const topUpMb = Number(this.configService.get<string>("MANGO_UNLOCK_TOPUP_MB", "100000"));
        try {
            const info = await this.mangoProxyApi.post<{ ret_data?: { last_flow?: number } }>("/user_info", { username });
            const remaining = Number(info?.data?.ret_data?.last_flow ?? 0);
            if (Number.isFinite(remaining) && remaining >= thresholdMb) return; // уже разблокирован
            await this.mangoProxyApi.post("/add_user_flow", { username, flow: topUpMb });
            await this.logger.log(
                "SYSTEM",
                `Mango unlock: +${topUpMb}МБ flow для ${username} (остаток был ${Number.isFinite(remaining) ? remaining : "?"}МБ)`,
            );
        } catch (e: unknown) {
            await this.logger.error(
                `Mango unlock не удался для ${username}: ${e instanceof Error ? e.message : String(e)} ` +
                    `(мастер-аккаунт Mango пополнен? иначе выключи MANGO_UNLOCK_ENABLED)`,
            );
        }
    }

    @OnEvent("user.distribute_traffic")
    async distributeTraffic(
        {
            tariff,
            traffic,
            userId,
            accountJustCreated,
        }: {
            tariff: PackageType;
            traffic: string;
            userId: string;
            accountJustCreated?: boolean;
        },
    ): Promise<boolean> {
        // SPRINT-1 (Task A): в gateway-режиме баланс ведём у себя (TrafficLog), в
        // апстрим Mango за доливкой трафика НЕ ходим. Это убирает блокирующий
        // /add_user_flow (sleep+ретраи+recovery) с горячего пути покупки/триала.
        if (this.isGatewayMode()) return true;

        if (tariff === "RESIDENT_PREMIUM") {
            const user = await this.userService.findById(userId);
            const trafficInMB = Math.ceil(Number(BigInt(traffic) / 1024n ** 2n));
            
            // Проверяем, есть ли у пользователя premiumUsername
            if (!user.premiumUsername || user.premiumUsername.length === 0) {
                await this.logger.error(`❌ У пользователя ${userId} нет premiumUsername, невозможно добавить трафик`, userId);
                throw new Error("У пользователя нет аккаунта Mango Proxy");
            }

            const [username] = user.premiumUsername.split(":");
            
            // Задержка только если аккаунт только что создан (чтобы Mango API успел его подхватить)
            if (accountJustCreated) {
                await this.logger.log("SYSTEM", `⏳ Ожидание 2 секунд перед добавлением трафика (чтобы пользователь успел создаться в Mango API)...`, userId, {
                    premiumUsername: user.premiumUsername,
                    extractedUsername: username,
                });
                await sleep(2000);
            }
            
            try {
                await this.logger.log("SYSTEM", `📤 Отправка запроса на добавление ${trafficInMB} МБ трафика для пользователя ${userId}`, userId, {
                    username,
                    flow: trafficInMB,
                });

                const distributeRes = await this.mangoProxyApi.post<{ code: string; msg: string; ret_data?: any }>("/add_user_flow", {
                    username,
                    flow: trafficInMB,
                });

                // Логируем полный ответ от Mango API
                await this.logger.log("SYSTEM", `📥 Ответ от Mango API /add_user_flow`, userId, {
                    statusCode: distributeRes.status,
                    responseData: distributeRes.data,
                });

                if (distributeRes.data.code === "1") {
                    await this.logger.log("SYSTEM", `✅ Успешно добавлено ${trafficInMB} МБ трафика для пользователя ${userId}`, userId);
                    return true;
                }
                
                // Если код не "1" - это ошибка
                await this.logger.error(`⚠️ Mango API вернул код ошибки: ${distributeRes.data.code}`, userId, {
                    code: distributeRes.data.code,
                    message: distributeRes.data.msg,
                    fullResponse: distributeRes.data,
                });
                
                throw new Error(`Mango API error: ${distributeRes.data.msg} (code: ${distributeRes.data.code})`);
            } catch (e: unknown) {
                const errorStr = this.mangoFlowErrorText(e);

                if (this.shouldRecreateMangoPremiumAfterFlowError(e)) {
                    await this.logger.log(
                        "SYSTEM",
                        `⚠️ Mango add_user_flow: ошибка, пробуем пересоздание по БД (${username})`,
                        userId,
                        { errorSummary: errorStr.slice(0, 500) },
                    );
                    const recovered = await this.recreateMangoPremiumFromDbAndRetryAddFlow(userId, trafficInMB);
                    if (recovered) return true;
                }

                await this.logger.error(`❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось добавить трафик для пользователя ${userId}. Операция будет отменена.`, userId, {
                    error: e,
                    errorMessage: errorStr,
                    traffic: trafficInMB + " МБ",
                    username,
                });

                throw new Error(`Не удалось добавить трафик в Mango Proxy: ${errorStr}`);
            }
        }
        return true;
    }

    async getAvailableLocations() {
        try {
            const locationsRes = await this.mangoProxyApi.post<{ data: { code: string }[] }>("/locations/countries", {
                limit: 1000,
            });
            return locationsRes.data.data.map((el) => el.code);
        } catch (e: unknown) {
            await this.logger.error(`Ошибка при парсинге доступных локаций на Mango Proxy: ${String(e)}`, undefined, e && typeof e === "object" ? e : undefined);
            return [];
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async updateUserBalances() {
        // SPRINT-1 (Task A): в gateway-режиме остаток считаем по TrafficLog, а не
        // тянем снапшот из Mango /user_info (устаревший снапшот = баг 8.1).
        if (this.isGatewayMode()) return;
        if (this.configService.get<string>("ENABLE_MANGO_SYNC", "false") !== "true") return;

        const allUsers = await this.userService.findMany({
            where: {
                emailVerified: true,
                premiumUsername: {
                    not: "",
                },
            },
        });

        for (const user of allUsers) {
            try {
                const userRes = await this.mangoProxyApi.post<{ ret_data: { last_flow: number } }>("/user_info", {
                    username: user.premiumUsername.split(":")[0],
                });
                if (userRes?.data?.ret_data && typeof userRes.data.ret_data.last_flow === "number") {
                    // last_flow может быть отрицательным, если Mango пропустил больше, чем квота — трактуем как 0
                    const lastFlowRaw = userRes.data.ret_data.last_flow;
                    if (isNaN(lastFlowRaw)) continue;
                    const lastFlow = Math.max(0, Math.floor(lastFlowRaw));

                    const newUserBalance = BigInt(lastFlow) * 1024n ** 2n;
                    const currentBalance = BigInt(user.premiumTrafficLeft);
                    const trafficSpent = currentBalance - newUserBalance;

                    // Обновляем только если разница больше 1 МБ и баланс не нулевой
                    if (trafficSpent > 1024n ** 2n && currentBalance !== 0n) {
                        await this.logger.log(
                            "USAGE",
                            `Пользователь ${user.id} потратил ${trafficSpent} байт трафика (Mango Premium).`,
                            user.id,
                            { used: String(trafficSpent), type: "RESIDENT_PREMIUM" },
                            true,
                        );
                        await this.logger.recordTrafficLogForUserTariff(user.id, "RESIDENT_PREMIUM", trafficSpent);
                        await this.userService.updateById(user.id, {
                            premiumTrafficLeft: String(newUserBalance),
                        });
                    }
                }
            } catch (e: unknown) {
                await this.logger.error(`Mango sync: ошибка для ${user.id}: ${String(e)}`, user.id);
            }
            await sleep(300);
        }
    }
}
