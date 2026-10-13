import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LogType, PackageType, Prisma, ProxyStatus, ProxyType } from "@prisma/client";
import { hash } from "argon2";
import { LoggerService } from "../logger/logger.service";
import { ModifyUserTrafficDto } from "./dtos/modify-user-traffic.dto";
import { GetAdminUsersDto } from "./dtos/get-admin-users.dto";
import { ModifyUserBalanceDto } from "./dtos/modify-user-balance.dto";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { randomBytes } from "crypto";
import { PackageService } from "../package/package.service";
import { Decimal } from "@prisma/client/runtime/library";
import { NotificationService } from "../notification/notification.service";
import { ConfigService } from "@nestjs/config";
import { ProvisioningQueueService } from "../provisioning/provisioning-queue.service";
import { TRIAL_TARIFFS } from "./trial-tariffs";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

@Injectable()
export class UserService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService,
        private readonly eventEmitter: EventEmitter2,
        @Inject(forwardRef(() => PackageService))
        private readonly packageService: PackageService,
        @Inject(forwardRef(() => NotificationService))
        private readonly notificationService: NotificationService,
        private readonly config: ConfigService,
        private readonly provisioningQueue: ProvisioningQueueService,
    ) {}

    /** SPRINT-1: Mango в gateway-режиме (см. MangoProxyProvider.isGatewayMode). */
    isMangoGatewayMode(): boolean {
        return this.config.get<string>("MANGO_MODE", "api") === "gateway";
    }

    async findById(id: string, excludePassword: boolean = true, excludeSystem: boolean = false) {
        const user = await this.prisma.user.findUnique({
            where: {
                id,
            },
            include: {
                accounts: { select: { id: true, type: true, provider: true, providerAccountId: true } },
            },
            omit: {
                password: excludePassword,
                residentData: excludeSystem,
                residentTotalUsed: excludeSystem,
                premiumUsername: excludeSystem,
                proxyEmpireSubUserToken: excludeSystem,
            },
        });

        if (!user) throw new NotFoundException("errors.user_not_found");

        return user;
    }

    async getUserTraffic(userId: string) {
        const now0 = Date.now();
        // Самое широкое окно — месяц: логи старше не влияют на результат, поэтому
        // фильтруем по дате и берём только нужные поля (иначе на юзерах с длинной
        // историей этот метод читал ВСЕ USAGE-логи целиком — источник лагов админки).
        const usageLogs = await this.logger.getLogs({
            where: { type: LogType.USAGE, userId, createdAt: { gte: new Date(now0 - 2_592_000_000) } },
            select: { metadata: true, createdAt: true },
        });

        const now = now0;
        const t = {
            hour: now - 3600_000,
            day: now - 86_400_000,
            week: now - 604_800_000,
            month: now - 2_592_000_000,
        };

        const result: Record<keyof typeof t, string> = {
            hour: "0",
            day: "0",
            week: "0",
            month: "0",
        };

        const ranges = Object.entries(t) as [keyof typeof t, number][];

        for (const [key, ts] of ranges) {
            const total = usageLogs
                .filter((log) => new Date(log.createdAt).getTime() >= ts)
                .reduce((acc: bigint, log) => {
                    try {
                        const used = BigInt((log.metadata as { used: string }).used);
                        return acc + used;
                    } catch {
                        return acc;
                    }
                }, 0n);

            result[key] = total.toString();
        }

        return result;
    }

    async findByEmail(email: string, excludePassword: boolean = true) {
        return this.prisma.user.findUnique({
            where: {
                email,
            },
            include: {
                accounts: { select: { id: true, type: true, provider: true, providerAccountId: true } },
            },
            omit: {
                password: excludePassword,
            },
        });
    }

    async findMany(query: Prisma.UserFindManyArgs) {
        return this.prisma.user.findMany(query);
    }

    /** Колонки БД для сортировки по трафику (включая историческую опечатку premium_trafic_left). */
    private static readonly TRAFFIC_SORT_COLUMNS: Record<string, string> = {
        premiumTrafficLeft: "premium_trafic_left",
        premiumResidentialTrafficLeft: "premium_residential_traffic_left",
        mobileGbTrafficLeft: "mobile_gb_traffic_left",
        mobileTrafficLeft: "mobile_traffic_left",
        ipv6GbTrafficLeft: "ipv6_gb_traffic_left",
        ispUsaTrafficLeft: "isp_usa_traffic_left",
        ispEuTrafficLeft: "isp_eu_traffic_left",
        residentialLiteTrafficLeft: "residential_lite_traffic_left",
    };

    /**
     * Админ-список пользователей (ТЗ 3.1–3.3): пагинация + поиск (id/email/tg) +
     * сортировка (дата/баланс/трафик). Без include payments/proxies и без N+1
     * getUserTraffic — старый GET /users/all грузил ВСЁ и лагал. Транзакции и
     * статистика юзера теперь берутся отдельными ленивыми эндпоинтами из модалок.
     */
    async findAdminUsers(dto: GetAdminUsersDto) {
        const { page, limit, sortBy, sortDir } = dto;
        const search = dto.search?.trim();
        const skip = (page - 1) * limit;

        const searchWhere: Prisma.UserWhereInput = search
            ? {
                  OR: [{ id: search }, { email: { contains: search, mode: "insensitive" } }, { tgLogin: { contains: search, mode: "insensitive" } }],
              }
            : {};

        const select = {
            id: true,
            email: true,
            authMethod: true,
            role: true,
            emailVerified: true,
            tgLogin: true,
            region: true,
            balance: true,
            referralBalance: true,
            trial: true,
            createdAt: true,
            updatedAt: true,
            residentTrafficLeft: true,
            premiumTrafficLeft: true,
            premiumResidentialTrafficLeft: true,
            mobileTrafficLeft: true,
            mobileGbTrafficLeft: true,
            ipv6GbTrafficLeft: true,
            ispUsaTrafficLeft: true,
            ispEuTrafficLeft: true,
            residentialLiteTrafficLeft: true,
            ispIpLeft: true,
            _count: {
                select: {
                    proxies: { where: { type: ProxyType.MOBILE, status: ProxyStatus.ACTIVE } },
                },
            },
        } satisfies Prisma.UserSelect;

        const total = await this.prisma.user.count({ where: searchWhere });

        let users: Array<Record<string, unknown> & { id: string; _count?: { proxies: number } }>;
        const trafficColumn = UserService.TRAFFIC_SORT_COLUMNS[sortBy];
        if (trafficColumn) {
            // Байты трафика хранятся СТРОКАМИ — prisma orderBy дал бы лексикографический
            // порядок ("9" > "100"). Порядок id берём raw-запросом с CAST AS NUMERIC
            // (имя колонки только из whitelist выше — SQL от клиента сюда не попадает),
            // затем findMany по id и восстанавливаем порядок.
            const dir = sortDir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
            const term = search ? `%${search}%` : null;
            const whereSql = term ? Prisma.sql`WHERE (email ILIKE ${term} OR tg_login ILIKE ${term} OR id = ${search})` : Prisma.empty;
            const rows = await this.prisma.$queryRaw<{ id: string }[]>(
                Prisma.sql`SELECT id FROM users ${whereSql}
                    ORDER BY CAST(COALESCE(NULLIF(${Prisma.raw(`"${trafficColumn}"`)}, ''), '0') AS NUMERIC) ${dir}, created_at DESC
                    LIMIT ${limit} OFFSET ${skip}`,
            );
            const ids = rows.map((r) => r.id);
            const unordered = await this.prisma.user.findMany({ where: { id: { in: ids } }, select });
            const byId = new Map(unordered.map((u) => [u.id, u]));
            users = ids.map((id) => byId.get(id)).filter((u): u is NonNullable<typeof u> => !!u);
        } else {
            users = await this.prisma.user.findMany({
                where: searchWhere,
                select,
                orderBy: sortBy === "balance" ? { balance: sortDir } : { createdAt: sortDir },
                skip,
                take: limit,
            });
        }

        return {
            users: users.map((u) => {
                const { _count, ...rest } = u;
                return { ...rest, mobileProxiesCount: _count?.proxies ?? 0 };
            }),
            total,
            page,
            limit,
        };
    }

    async updateById(id: string, data: Prisma.UserUpdateInput, excludePassword: boolean = false) {
        return this.prisma.user.update({
            where: {
                id,
            },
            data,
            omit: {
                password: excludePassword,
            },
        });
    }

    async create(data: Prisma.UserCreateInput) {
        return this.prisma.user.create({
            data: {
                ...data,
                password: data.password ? await hash(data.password) : "",
            },
            include: {
                accounts: { select: { id: true, type: true, provider: true, providerAccountId: true } },
            },
        });
    }

    async generateApiKey(userId: string): Promise<string> {
        const apiKey = randomBytes(32).toString("hex");

        await this.prisma.user.update({
            where: { id: userId },
            data: { apiKey },
        });

        return apiKey;
    }

    async findByApiKey(apiKey: string) {
        return this.prisma.user.findUnique({
            where: { apiKey },
            include: {
                accounts: { select: { id: true, type: true, provider: true, providerAccountId: true } },
            },
            omit: {
                password: true,
                residentData: true,
                residentTotalUsed: true,
                premiumUsername: true,
                proxyEmpireSubUserToken: true,
            },
        });
    }

    async getReferralsCount(userId: string): Promise<number> {
        return this.prisma.user.count({
            where: {
                referrerId: userId,
            },
        });
    }

    async getReferralRewards(userId: string) {
        const rewards = await this.prisma.referralReward.findMany({
            where: {
                referrerId: userId,
            },
            include: {
                referral: {
                    select: {
                        id: true,
                        email: true,
                        tgLogin: true,
                    },
                },
                payment: {
                    select: {
                        id: true,
                        metadata: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const rewardsWithTariff = await Promise.all(
            rewards.map(async (reward) => {
                const metadata = isRecord(reward.payment.metadata) ? reward.payment.metadata : {};
                const contents = Array.isArray(metadata.contents) ? metadata.contents : [];
                const firstContent = isRecord(contents[0]) ? contents[0] : {};
                const contentType = firstContent.type;

                // Определяем тип тарифа из метаданных платежа
                let tariffType = "";
                if (contentType === "resident") {
                    tariffType = "Resident 2#";
                } else if (contentType === "package") {
                    // Получаем тип из пакета
                    const packageData = typeof firstContent.packageId === "string" ? await this.packageService.findById(firstContent.packageId) : null;
                    if (packageData) {
                        if (packageData.type === "RESIDENT_PREMIUM") {
                            tariffType = "Resident 2#";
                        } else if (packageData.type === "MOBILE_GB") {
                            tariffType = "Mobile";
                        } else if (packageData.type === "IPV6_GB") {
                            tariffType = "ISP";
                        } else {
                            tariffType = "Mobile";
                        }
                    } else {
                        tariffType = "Package";
                    }
                } else if (contentType === "mobile") {
                    tariffType = "Mobile";
                } else if (contentType === "isp") {
                    tariffType = "ISP";
                }

                return {
                    id: reward.id,
                    referralName: reward.referral.tgLogin || reward.referral.email,
                    tariffType,
                    amount: Number(reward.amount),
                    createdAt: reward.createdAt,
                };
            }),
        );

        return rewardsWithTariff;
    }

    @OnEvent("user.distribute_traffic")
    async distributeTraffic({ tariff, traffic, userId }: { tariff: PackageType; traffic: string; userId: string }) {
        const user = await this.findById(userId);
        if (user) {
            // Создаем пакет, если у пользователя еще нет пакетов этого типа.
            await this.packageService.createPackageIfNotExists(tariff, traffic, userId);

            // Начисление должно быть атомарным: read-modify-write через ранее
            // загруженный объект user мог затереть параллельное списание gateway
            // или второе пополнение того же тарифа.
            const columnByTariff: Record<string, string> = {
                RESIDENT_PREMIUM: "premium_trafic_left",
                IPV6_GB: "ipv6_gb_traffic_left",
                MOBILE_GB: "mobile_gb_traffic_left",
                PREMIUM_RESIDENTIAL: "premium_residential_traffic_left",
                MOBILE: "mobile_traffic_left",
                ISP_USA: "isp_usa_traffic_left",
                ISP_EU: "isp_eu_traffic_left",
                RESIDENTIAL_LITE: "residential_lite_traffic_left",
            };
            const column = columnByTariff[tariff];
            if (column) {
                await this.prisma.$executeRawUnsafe(
                    `UPDATE "users"
                     SET "${column}" = (CAST("${column}" AS NUMERIC) + $1::numeric)::text
                     WHERE "id" = $2`,
                    traffic,
                    userId,
                );
            }
        }
    }

    async modifyUserTraffic(dto: ModifyUserTrafficDto, userId: string) {
        const oldUser = (await this.findById(userId)) as {
            premiumTrafficLeft: string;
            mobileGbTrafficLeft?: string | null;
            ipv6GbTrafficLeft?: string | null;
            premiumResidentialTrafficLeft?: string | null;
            mobileTrafficLeft?: string | null;
            ispUsaTrafficLeft?: string | null;
            ispEuTrafficLeft?: string | null;
            residentialLiteTrafficLeft?: string | null;
            premiumUsername?: string | null;
        };
        const ONE_MB = 1024n * 1024n;

        const premiumTraffic = dto.premiumTrafficLeft !== undefined ? String(BigInt(Math.round(dto.premiumTrafficLeft * 1024 ** 2)) * 1024n) : oldUser.premiumTrafficLeft;
        const mobileGbTraffic = dto.mobileGbTrafficLeft !== undefined ? String(BigInt(Math.round(dto.mobileGbTrafficLeft * 1024 ** 2)) * 1024n) : String(oldUser.mobileGbTrafficLeft || "0");
        const ipv6GbTraffic = dto.ipv6GbTrafficLeft !== undefined ? String(BigInt(Math.round(dto.ipv6GbTrafficLeft * 1024 ** 2)) * 1024n) : String(oldUser.ipv6GbTrafficLeft || "0");
        const premiumTrafficDifference = BigInt(premiumTraffic) - BigInt(oldUser.premiumTrafficLeft);
        const mobileGbTrafficDifference = BigInt(mobileGbTraffic) - BigInt(oldUser.mobileGbTrafficLeft || "0");
        const ipv6GbTrafficDifference = BigInt(ipv6GbTraffic) - BigInt(oldUser.ipv6GbTrafficLeft || "0");

        // Новые балансы (PREMIUM_RESIDENTIAL + новый MOBILE GB через ProxyEmpire) — опциональны.
        // Если поле в dto не пришло — оставляем как есть.
        const oldPremResidential = BigInt(oldUser.premiumResidentialTrafficLeft || "0");
        const oldMobile = BigInt(oldUser.mobileTrafficLeft || "0");
        const premiumResidentialTraffic =
            dto.premiumResidentialTrafficLeft !== undefined ? String(BigInt(Math.round(dto.premiumResidentialTrafficLeft * 1024 ** 2)) * 1024n) : String(oldPremResidential);
        const mobileTraffic = dto.mobileTrafficLeft !== undefined ? String(BigInt(Math.round(dto.mobileTrafficLeft * 1024 ** 2)) * 1024n) : String(oldMobile);
        const premiumResidentialDifference = BigInt(premiumResidentialTraffic) - oldPremResidential;
        const mobileDifference = BigInt(mobileTraffic) - oldMobile;

        // Новые типы (ISP_USA / ISP_EU / RESIDENTIAL_LITE) — опциональны, считаются на нашей стороне.
        const oldIspUsa = BigInt(oldUser.ispUsaTrafficLeft || "0");
        const oldIspEu = BigInt(oldUser.ispEuTrafficLeft || "0");
        const oldResidentialLite = BigInt(oldUser.residentialLiteTrafficLeft || "0");
        const ispUsaTraffic = dto.ispUsaTrafficLeft !== undefined ? String(BigInt(Math.round(dto.ispUsaTrafficLeft * 1024 ** 2)) * 1024n) : String(oldIspUsa);
        const ispEuTraffic = dto.ispEuTrafficLeft !== undefined ? String(BigInt(Math.round(dto.ispEuTrafficLeft * 1024 ** 2)) * 1024n) : String(oldIspEu);
        const residentialLiteTraffic = dto.residentialLiteTrafficLeft !== undefined ? String(BigInt(Math.round(dto.residentialLiteTrafficLeft * 1024 ** 2)) * 1024n) : String(oldResidentialLite);
        const ispUsaDifference = BigInt(ispUsaTraffic) - oldIspUsa;
        const ispEuDifference = BigInt(ispEuTraffic) - oldIspEu;
        const residentialLiteDifference = BigInt(residentialLiteTraffic) - oldResidentialLite;

        // Если устанавливаем трафик >= 1 МБ, создаем аккаунт и добавляем разницу
        if (dto.premiumTrafficLeft !== undefined && premiumTrafficDifference > 1000n) {
            await this.eventEmitter.emitAsync("proxy.create_account", {
                type: "RESIDENT_PREMIUM",
                userId,
            });
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "RESIDENT_PREMIUM",
                traffic: String(premiumTrafficDifference),
                userId,
                accountJustCreated: !oldUser?.premiumUsername?.length,
            });
        } else if (dto.premiumTrafficLeft !== undefined && BigInt(premiumTraffic) >= ONE_MB) {
            // Если трафик >= 1 МБ, но разница небольшая — убедимся что пакет есть
            await this.packageService.createPackageIfNotExists("RESIDENT_PREMIUM", premiumTraffic, userId);
        }

        if (dto.mobileGbTrafficLeft !== undefined && mobileGbTrafficDifference > 1000n) {
            await this.eventEmitter.emitAsync("proxy.create_account", {
                type: "MOBILE_GB",
                userId,
            });
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "MOBILE_GB",
                traffic: String(mobileGbTrafficDifference),
                userId,
            });
        } else if (dto.mobileGbTrafficLeft !== undefined && BigInt(mobileGbTraffic) >= ONE_MB) {
            await this.packageService.createPackageIfNotExists("MOBILE_GB", mobileGbTraffic, userId);
        }

        if (dto.ipv6GbTrafficLeft !== undefined && ipv6GbTrafficDifference > 1000n) {
            await this.eventEmitter.emitAsync("proxy.create_account", {
                type: "IPV6_GB",
                userId,
            });
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "IPV6_GB",
                traffic: String(ipv6GbTrafficDifference),
                userId,
            });
        } else if (dto.ipv6GbTrafficLeft !== undefined && BigInt(ipv6GbTraffic) >= ONE_MB) {
            await this.packageService.createPackageIfNotExists("IPV6_GB", ipv6GbTraffic, userId);
        }

        // PREMIUM_RESIDENTIAL (ProxyEmpire) — без gateway, просто обновляем баланс.
        // Distribute event тоже шлём — на случай если где-то слушают (например для логов/пакета).
        if (dto.premiumResidentialTrafficLeft !== undefined && premiumResidentialDifference > 1000n) {
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "PREMIUM_RESIDENTIAL",
                traffic: String(premiumResidentialDifference),
                userId,
            });
        } else if (dto.premiumResidentialTrafficLeft !== undefined && BigInt(premiumResidentialTraffic) >= ONE_MB) {
            await this.packageService.createPackageIfNotExists("PREMIUM_RESIDENTIAL" as PackageType, premiumResidentialTraffic, userId);
        }

        if (dto.mobileTrafficLeft !== undefined && mobileDifference > 1000n) {
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "MOBILE",
                traffic: String(mobileDifference),
                userId,
            });
        } else if (dto.mobileTrafficLeft !== undefined && BigInt(mobileTraffic) >= ONE_MB) {
            await this.packageService.createPackageIfNotExists("MOBILE" as PackageType, mobileTraffic, userId);
        }

        // Новые типы — без апстрим-аккаунта (баланс в нашей БД), distribute создаёт пакет + начисляет.
        for (const [tariff, diff, total, requested] of [
            ["ISP_USA", ispUsaDifference, ispUsaTraffic, dto.ispUsaTrafficLeft],
            ["ISP_EU", ispEuDifference, ispEuTraffic, dto.ispEuTrafficLeft],
            ["RESIDENTIAL_LITE", residentialLiteDifference, residentialLiteTraffic, dto.residentialLiteTrafficLeft],
        ] as [PackageType, bigint, string, number | undefined][]) {
            if (requested === undefined) continue;
            if (diff > 1000n) {
                await this.eventEmitter.emitAsync("user.distribute_traffic", {
                    tariff,
                    traffic: String(diff),
                    userId,
                });
            } else if (BigInt(total) >= ONE_MB) {
                await this.packageService.createPackageIfNotExists(tariff, total, userId);
            }
        }

        // Положительная разница уже начислена атомарно обработчиком события.
        // Записываем только явно переданные уменьшения/микроизменения: так скрытые
        // тарифы и параллельные списания gateway не будут затёрты старым снимком.
        const directUpdate: Prisma.UserUpdateInput = {};
        const balances = [
            ["premiumTrafficLeft", premiumTraffic, premiumTrafficDifference, dto.premiumTrafficLeft],
            ["mobileGbTrafficLeft", mobileGbTraffic, mobileGbTrafficDifference, dto.mobileGbTrafficLeft],
            ["ipv6GbTrafficLeft", ipv6GbTraffic, ipv6GbTrafficDifference, dto.ipv6GbTrafficLeft],
            ["premiumResidentialTrafficLeft", premiumResidentialTraffic, premiumResidentialDifference, dto.premiumResidentialTrafficLeft],
            ["mobileTrafficLeft", mobileTraffic, mobileDifference, dto.mobileTrafficLeft],
            ["ispUsaTrafficLeft", ispUsaTraffic, ispUsaDifference, dto.ispUsaTrafficLeft],
            ["ispEuTrafficLeft", ispEuTraffic, ispEuDifference, dto.ispEuTrafficLeft],
            ["residentialLiteTrafficLeft", residentialLiteTraffic, residentialLiteDifference, dto.residentialLiteTrafficLeft],
        ] as const;
        for (const [field, value, diff, requested] of balances) {
            if (requested !== undefined && diff <= 1000n && diff !== 0n) {
                directUpdate[field] = value;
            }
        }
        if (Object.keys(directUpdate).length > 0) {
            return this.updateById(userId, directUpdate);
        }
        return this.findById(userId);
    }

    async modifyUserBalance(dto: ModifyUserBalanceDto, userId: string) {
        const user = await this.findById(userId);
        const oldBalance = user.balance;

        await this.logger.log("SYSTEM", `Админ изменил баланс пользователя ${userId}`, userId, {
            oldBalance: oldBalance.toString(),
            newBalance: dto.balance.toString(),
        });

        return this.updateById(userId, {
            balance: new Decimal(dto.balance),
        });
    }

    async getTrial(userId: string, tariffType: PackageType) {
        const user = await this.findById(userId);

        // Проверяем, что у пользователя еще нет триала
        if (user.trial !== null) {
            throw new BadRequestException("errors.trial_already_received");
        }

        // Проверяем валидность тарифа (тарифы по ГБ, включая новые типы через гейтвей)
        if (!TRIAL_TARIFFS.includes(tariffType)) {
            throw new BadRequestException("errors.invalid_tariff_for_trial");
        }

        // Антифрод (Часть 2 ТЗ): триал только при наличии верифицированной привязки
        // Google/Telegram, которая ранее не использовала триал на другой учётке.
        const linkedAccounts = await this.prisma.account.findMany({
            where: { userId, provider: { in: ["GOOGLE", "TELEGRAM"] } },
            select: { provider: true, providerAccountId: true },
        });
        // Вход через Google/Telegram = уже верифицированная личность (при OAuth-логине
        // запись account создаётся автоматически). Не просим «привязать» того, кто и так
        // вошёл через провайдера, даже если по какой-то причине строки account нет.
        const isOAuthUser = user.authMethod === "GOOGLE" || user.authMethod === "TELEGRAM";
        if (linkedAccounts.length === 0 && !isOAuthUser) {
            await this.notificationService.createOnce({
                userId,
                type: "trial_link_required",
                title: "Привяжите аккаунт для пробного периода",
                body: "Чтобы активировать триал, привяжите Google или Telegram в настройках профиля. Это защита от злоупотреблений.",
                link: "/dashboard#linked-accounts",
            });
            throw new BadRequestException("errors.trial_requires_linked_account");
        }
        if (linkedAccounts.length > 0) {
            const usedIdentity = await this.prisma.trialIdentity.findFirst({
                where: {
                    OR: linkedAccounts.map((a) => ({ provider: a.provider, providerKey: a.providerAccountId })),
                },
            });
            if (usedIdentity && usedIdentity.usedByUserId !== userId) {
                throw new BadRequestException("errors.trial_identity_already_used");
            }
        }

        // Резервируем триал до любых внешних/денежных побочных эффектов.
        // Проверка выше сама по себе не защищает от двух одновременных запросов:
        // оба могли прочитать trial=null и оба начислить трафик.
        const databaseManagedTrial = tariffType !== "RESIDENT_PREMIUM" || this.isMangoGatewayMode();
        const databaseGrant = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const claim = await tx.user.updateMany({
                where: { id: userId, trial: null },
                data: { trial: new Date(), trialDiscountAvailable: true },
            });

            if (claim.count !== 1) {
                throw new BadRequestException("errors.trial_already_received");
            }

            if (linkedAccounts.length > 0) {
                await tx.trialIdentity.createMany({
                    data: linkedAccounts.map((account) => ({
                        provider: account.provider,
                        providerKey: account.providerAccountId,
                        usedByUserId: userId,
                    })),
                    skipDuplicates: true,
                });

                // Повторно проверяем после unique insert: другой аккаунт мог
                // зарезервировать ту же OAuth-личность между findFirst выше и claim.
                const claimedIdentities = await tx.trialIdentity.findMany({
                    where: {
                        OR: linkedAccounts.map((account) => ({
                            provider: account.provider,
                            providerKey: account.providerAccountId,
                        })),
                    },
                    select: { usedByUserId: true },
                });

                if (claimedIdentities.some((identity) => identity.usedByUserId !== userId)) {
                    throw new BadRequestException("errors.trial_identity_already_used");
                }
            }

            // Gateway-тарифы учитываются только в нашей БД. Выдаём пакет и
            // баланс в той же транзакции, что и claim: ошибка не оставит
            // потраченный триал без трафика, а повторный запрос не задвоит его.
            if (databaseManagedTrial) {
                const createdPackage = await tx.userPackage.upsert({
                    where: { userId_type: { userId, type: tariffType as ProxyType } },
                    create: { userId, type: tariffType as ProxyType },
                    update: {},
                });

                const columnByTariff: Partial<Record<PackageType, string>> = {
                    RESIDENT_PREMIUM: "premium_trafic_left",
                    ISP_USA: "isp_usa_traffic_left",
                    ISP_EU: "isp_eu_traffic_left",
                    RESIDENTIAL_LITE: "residential_lite_traffic_left",
                };
                const column = columnByTariff[tariffType];
                if (!column) throw new BadRequestException("errors.invalid_tariff_for_trial");

                await tx.$executeRawUnsafe(
                    `UPDATE "users"
                     SET "${column}" = (CAST("${column}" AS NUMERIC) + $1::numeric)::text
                     WHERE "id" = $2`,
                    String(100 * 1024 * 1024),
                    userId,
                );

                return createdPackage;
            }

            return null;
        });

        // 100 МБ в байтах
        const trialTraffic = String(100 * 1024 * 1024);

        try {
            if (databaseManagedTrial) {
                if (tariffType === "RESIDENT_PREMIUM") {
                    // Account provisioning remains asynchronous; grant is already
                    // committed locally and first proxy generation can provision lazily.
                    this.provisioningQueue.enqueue(userId, tariffType);
                }
            } else {
                // api-режим: старое поведение — синхронно создаём аккаунт, затем трафик.
                await this.eventEmitter.emitAsync("proxy.create_account", {
                    type: tariffType,
                    userId,
                });
                await this.eventEmitter.emitAsync("user.distribute_traffic", {
                    tariff: tariffType,
                    traffic: trialTraffic,
                    userId,
                    accountJustCreated: tariffType === "RESIDENT_PREMIUM" ? !user?.premiumUsername?.length : undefined,
                });
            }
        } catch (e: unknown) {
            // Если не удалось добавить трафик/создать пакет - выбрасываем ошибку
            const errorMsg = e instanceof Error ? e.message : String(e);
            throw new BadRequestException(`Не удалось активировать триал: ${errorMsg}`);
        }

        // Получаем созданный пакет
        const trialPackage = databaseGrant ?? (await this.packageService.getUserPackages(userId)).find((pkg) => pkg.type === tariffType);

        if (!trialPackage) {
            throw new NotFoundException("errors.package_not_created");
        }

        // Ошибка уведомления не должна превращать уже выданный триал в ложный
        // ответ «не удалось активировать»: повторный запрос всё равно запрещён.
        try {
            await this.notificationService.create({
                userId,
                type: "trial_discount",
                title: "Скидка 30% активна",
                body: "Пробный период активирован. Скидка 30% применится автоматически к первой покупке любого пакета.",
                link: "/payment",
            });
        } catch (error: unknown) {
            await this.logger.error(`Не удалось создать уведомление о триале для пользователя ${userId}`, userId, { error: error instanceof Error ? error.message : String(error) });
        }

        return { userPackageId: trialPackage.id };
    }
}
