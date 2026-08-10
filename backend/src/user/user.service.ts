import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LogType, PackageType, Prisma, ProxyStatus, ProxyType } from "@prisma/client";
import { hash } from "argon2";
import { LoggerService } from "../logger/logger.service";
import { ModifyUserTrafficDto } from "./dtos/modify-user-traffic.dto";
import { GetAdminUsersDto } from "./dtos/get-admin-users.dto";
import { ModifyUserBalanceDto } from "./dtos/modify-user-balance.dto";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { createHash } from "crypto";
import { PackageService } from "../package/package.service";
import { Decimal } from "@prisma/client/runtime/library";
import { NotificationService } from "../notification/notification.service";
import { ConfigService } from "@nestjs/config";
import { ProvisioningQueueService } from "../provisioning/provisioning-queue.service";

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
                accounts: true,
            },
            omit: {
                password: excludePassword,
                residentData: excludeSystem,
                residentTotalUsed: excludeSystem,
                premiumUsername: excludeSystem,
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
                accounts: true,
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
                  OR: [
                      { id: search },
                      { email: { contains: search, mode: "insensitive" } },
                      { tgLogin: { contains: search, mode: "insensitive" } },
                  ],
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
            const whereSql = term
                ? Prisma.sql`WHERE (email ILIKE ${term} OR tg_login ILIKE ${term} OR id = ${search})`
                : Prisma.empty;
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
                accounts: true,
            },
        });
    }

    private generateApiKeyHash(userId: string, timestamp: number): string {
        const data = `${userId}:${timestamp}`;
        return createHash("sha256").update(data).digest("hex");
    }

    async generateApiKey(userId: string): Promise<string> {
        const timestamp = Date.now();
        const apiKey = this.generateApiKeyHash(userId, timestamp);
        
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
                accounts: true,
            },
            omit: {
                password: true,
                residentData: true,
                residentTotalUsed: true,
                premiumUsername: true,
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
                const metadata = reward.payment.metadata as any;
                const contents = metadata?.contents || [];
                const firstContent = contents[0] || {};

                // Определяем тип тарифа из метаданных платежа
                let tariffType = "";
                if (firstContent.type === "resident") {
                    tariffType = "Resident 2#";
                } else if (firstContent.type === "package") {
                    // Получаем тип из пакета
                    const packageData = await this.packageService.findById(firstContent.packageId);
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
                } else if (firstContent.type === "mobile") {
                    tariffType = "Mobile";
                } else if (firstContent.type === "isp") {
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
            // Создаем пакет, если у пользователя еще нет пакетов этого типа
            await this.packageService.createPackageIfNotExists(tariff, traffic, userId);

            // Начисляем ТОЛЬКО поле начисляемого тарифа — не переписываем остальные балансы
            // снапшотом (иначе параллельное списание трафика по другому типу через гейтвей
            // могло быть затёрто устаревшим значением).
            const fieldByTariff: Record<string, string> = {
                RESIDENT_PREMIUM: "premiumTrafficLeft",
                IPV6_GB: "ipv6GbTrafficLeft",
                MOBILE_GB: "mobileGbTrafficLeft",
                PREMIUM_RESIDENTIAL: "premiumResidentialTrafficLeft",
                MOBILE: "mobileTrafficLeft",
                ISP_USA: "ispUsaTrafficLeft",
                ISP_EU: "ispEuTrafficLeft",
                RESIDENTIAL_LITE: "residentialLiteTrafficLeft",
            };
            const field = fieldByTariff[tariff as string];
            if (field) {
                const current = BigInt((user as any)[field] || "0");
                await this.prisma.user.update({
                    where: { id: userId },
                    data: { [field]: String(current + BigInt(traffic)) } as any,
                });
            }
        }
    }

    async modifyUserTraffic(dto: ModifyUserTrafficDto, userId: string) {
        const oldUser = await this.findById(userId);
        const ONE_MB = 1024n * 1024n;
        
        const premiumTraffic = String(BigInt(Math.round(dto.premiumTrafficLeft * 1024 ** 2)) * 1024n);
        const mobileGbTraffic = String(BigInt(Math.round(dto.mobileGbTrafficLeft * 1024 ** 2)) * 1024n);
        const ipv6GbTraffic = String(BigInt(Math.round(dto.ipv6GbTrafficLeft * 1024 ** 2)) * 1024n);
        const premiumTrafficDifference = BigInt(premiumTraffic) - BigInt(oldUser.premiumTrafficLeft);
        const mobileGbTrafficDifference = BigInt(mobileGbTraffic) - BigInt(oldUser.mobileGbTrafficLeft || "0");
        const ipv6GbTrafficDifference = BigInt(ipv6GbTraffic) - BigInt(oldUser.ipv6GbTrafficLeft || "0");

        // Новые балансы (PREMIUM_RESIDENTIAL + новый MOBILE GB через ProxyEmpire) — опциональны.
        // Если поле в dto не пришло — оставляем как есть.
        const oldPremResidential = BigInt((oldUser as any).premiumResidentialTrafficLeft || "0");
        const oldMobile = BigInt((oldUser as any).mobileTrafficLeft || "0");
        const premiumResidentialTraffic =
            dto.premiumResidentialTrafficLeft !== undefined
                ? String(BigInt(Math.round(dto.premiumResidentialTrafficLeft * 1024 ** 2)) * 1024n)
                : String(oldPremResidential);
        const mobileTraffic =
            dto.mobileTrafficLeft !== undefined
                ? String(BigInt(Math.round(dto.mobileTrafficLeft * 1024 ** 2)) * 1024n)
                : String(oldMobile);
        const premiumResidentialDifference = BigInt(premiumResidentialTraffic) - oldPremResidential;
        const mobileDifference = BigInt(mobileTraffic) - oldMobile;

        // Новые типы (ISP_USA / ISP_EU / RESIDENTIAL_LITE) — опциональны, считаются на нашей стороне.
        const oldIspUsa = BigInt((oldUser as any).ispUsaTrafficLeft || "0");
        const oldIspEu = BigInt((oldUser as any).ispEuTrafficLeft || "0");
        const oldResidentialLite = BigInt((oldUser as any).residentialLiteTrafficLeft || "0");
        const ispUsaTraffic =
            dto.ispUsaTrafficLeft !== undefined
                ? String(BigInt(Math.round(dto.ispUsaTrafficLeft * 1024 ** 2)) * 1024n)
                : String(oldIspUsa);
        const ispEuTraffic =
            dto.ispEuTrafficLeft !== undefined
                ? String(BigInt(Math.round(dto.ispEuTrafficLeft * 1024 ** 2)) * 1024n)
                : String(oldIspEu);
        const residentialLiteTraffic =
            dto.residentialLiteTrafficLeft !== undefined
                ? String(BigInt(Math.round(dto.residentialLiteTrafficLeft * 1024 ** 2)) * 1024n)
                : String(oldResidentialLite);
        const ispUsaDifference = BigInt(ispUsaTraffic) - oldIspUsa;
        const ispEuDifference = BigInt(ispEuTraffic) - oldIspEu;
        const residentialLiteDifference = BigInt(residentialLiteTraffic) - oldResidentialLite;
        
        // Если устанавливаем трафик >= 1 МБ, создаем аккаунт и добавляем разницу
        if (premiumTrafficDifference > 1000n) {
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
        } else if (BigInt(premiumTraffic) >= ONE_MB) {
            // Если трафик >= 1 МБ, но разница небольшая — убедимся что пакет есть
            await this.packageService.createPackageIfNotExists("RESIDENT_PREMIUM", premiumTraffic, userId);
        }
        
        if (mobileGbTrafficDifference > 1000n) {
            await this.eventEmitter.emitAsync("proxy.create_account", {
                type: "MOBILE_GB",
                userId,
            });
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "MOBILE_GB",
                traffic: String(mobileGbTrafficDifference),
                userId,
            });
        } else if (BigInt(mobileGbTraffic) >= ONE_MB) {
            await this.packageService.createPackageIfNotExists("MOBILE_GB", mobileGbTraffic, userId);
        }
        
        if (ipv6GbTrafficDifference > 1000n) {
            await this.eventEmitter.emitAsync("proxy.create_account", {
                type: "IPV6_GB",
                userId,
            });
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "IPV6_GB",
                traffic: String(ipv6GbTrafficDifference),
                userId,
            });
        } else if (BigInt(ipv6GbTraffic) >= ONE_MB) {
            await this.packageService.createPackageIfNotExists("IPV6_GB", ipv6GbTraffic, userId);
        }
        
        // PREMIUM_RESIDENTIAL (ProxyEmpire) — без gateway, просто обновляем баланс.
        // Distribute event тоже шлём — на случай если где-то слушают (например для логов/пакета).
        if (premiumResidentialDifference > 1000n) {
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "PREMIUM_RESIDENTIAL",
                traffic: String(premiumResidentialDifference),
                userId,
            });
        } else if (BigInt(premiumResidentialTraffic) >= ONE_MB) {
            await this.packageService.createPackageIfNotExists("PREMIUM_RESIDENTIAL" as any, premiumResidentialTraffic, userId);
        }

        if (mobileDifference > 1000n) {
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: "MOBILE",
                traffic: String(mobileDifference),
                userId,
            });
        } else if (BigInt(mobileTraffic) >= ONE_MB) {
            await this.packageService.createPackageIfNotExists("MOBILE" as any, mobileTraffic, userId);
        }

        // Новые типы — без апстрим-аккаунта (баланс в нашей БД), distribute создаёт пакет + начисляет.
        for (const [tariff, diff, total] of [
            ["ISP_USA", ispUsaDifference, ispUsaTraffic],
            ["ISP_EU", ispEuDifference, ispEuTraffic],
            ["RESIDENTIAL_LITE", residentialLiteDifference, residentialLiteTraffic],
        ] as [string, bigint, string][]) {
            if (diff > 1000n) {
                await this.eventEmitter.emitAsync("user.distribute_traffic", {
                    tariff,
                    traffic: String(diff),
                    userId,
                });
            } else if (BigInt(total) >= ONE_MB) {
                await this.packageService.createPackageIfNotExists(tariff as any, total, userId);
            }
        }

        return this.updateById(userId, {
            premiumTrafficLeft: premiumTraffic,
            mobileGbTrafficLeft: mobileGbTraffic,
            ipv6GbTrafficLeft: ipv6GbTraffic,
            premiumResidentialTrafficLeft: premiumResidentialTraffic,
            mobileTrafficLeft: mobileTraffic,
            ispUsaTrafficLeft: ispUsaTraffic,
            ispEuTrafficLeft: ispEuTraffic,
            residentialLiteTrafficLeft: residentialLiteTraffic,
        } as any);
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
        const validTariffs: PackageType[] = [
            "RESIDENT_PREMIUM",
            "MOBILE_GB",
            "IPV6_GB",
            "ISP_USA",
            "ISP_EU",
            "RESIDENTIAL_LITE",
        ];
        if (!validTariffs.includes(tariffType)) {
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

        // 100 МБ в байтах
        const trialTraffic = String(100 * 1024 * 1024);

        try {
            if (this.isMangoGatewayMode()) {
                // SPRINT-1 (Task C): триал = быстрые операции в нашей БД. Баланс и
                // пакет начисляем синхронно (без апстрим-API), а провижининг
                // апстрим-аккаунта Mango уводим В ФОН — не вешаем триал на
                // медленном/недоступном Mango (первопричина «Попробуйте через 15 минут»).
                // Если фон не успеет — аккаунт лениво создастся при первой
                // генерации прокси (generatePackageProxy).
                await this.eventEmitter.emitAsync("user.distribute_traffic", {
                    tariff: tariffType,
                    traffic: trialTraffic,
                    userId,
                    accountJustCreated: tariffType === "RESIDENT_PREMIUM" ? !user?.premiumUsername?.length : undefined,
                });
                // Провижининг апстрим-аккаунта — в очередь с идемпотентными ретраями
                // (не блокируем триал; при сбое повторит, иначе досоздастся лениво при генерации).
                this.provisioningQueue.enqueue(userId, tariffType);
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

        // Отмечаем триал, выдаём скидку на первую покупку, фиксируем identity (антифрод)
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: { trial: new Date(), trialDiscountAvailable: true } as any,
            }),
            this.prisma.trialIdentity.createMany({
                data: linkedAccounts.map((a) => ({
                    provider: a.provider,
                    providerKey: a.providerAccountId,
                    usedByUserId: userId,
                })),
                skipDuplicates: true,
            }),
        ]);

        // Уведомление о скидке после триала (Часть 2.3 ТЗ)
        await this.notificationService.create({
            userId,
            type: "trial_discount",
            title: "Скидка 30% активна",
            body: "Пробный период активирован. Скидка 30% применится автоматически к первой покупке любого пакета.",
            link: "/payment",
        });

        // Получаем созданный пакет
        const userPackage = await this.packageService.getUserPackages(userId);
        const trialPackage = userPackage.find(pkg => pkg.type === tariffType);
        
        if (!trialPackage) {
            throw new NotFoundException("errors.package_not_created");
        }

        return { userPackageId: trialPackage.id };
    }
}
