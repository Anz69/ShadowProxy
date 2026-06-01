import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LogType, PackageType, Prisma } from "@prisma/client";
import { hash } from "argon2";
import { LoggerService } from "../logger/logger.service";
import { ModifyUserTrafficDto } from "./dtos/modify-user-traffic.dto";
import { ModifyUserBalanceDto } from "./dtos/modify-user-balance.dto";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { createHash } from "crypto";
import { PackageService } from "../package/package.service";
import { Decimal } from "@prisma/client/runtime/library";
import { NotificationService } from "../notification/notification.service";

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
    ) {}

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
        const usageLogs = await this.logger.getLogs({
            where: { type: LogType.USAGE, userId },
        });

        const now = Date.now();
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

            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    residentTrafficLeft: user.residentTrafficLeft,
                    premiumTrafficLeft: tariff === "RESIDENT_PREMIUM" ? String(BigInt(user.premiumTrafficLeft) + BigInt(traffic)) : user.premiumTrafficLeft,
                    ipv6GbTrafficLeft: tariff === "IPV6_GB" ? String(BigInt(user.ipv6GbTrafficLeft || "0") + BigInt(traffic)) : user.ipv6GbTrafficLeft || "0",
                    mobileGbTrafficLeft: tariff === "MOBILE_GB" ? String(BigInt(user.mobileGbTrafficLeft || "0") + BigInt(traffic)) : user.mobileGbTrafficLeft || "0",
                    premiumResidentialTrafficLeft: (tariff as string) === "PREMIUM_RESIDENTIAL" ? String(BigInt((user as any).premiumResidentialTrafficLeft || "0") + BigInt(traffic)) : (user as any).premiumResidentialTrafficLeft || "0",
                    mobileTrafficLeft: tariff === "MOBILE" ? String(BigInt((user as any).mobileTrafficLeft || "0") + BigInt(traffic)) : (user as any).mobileTrafficLeft || "0",
                } as any,
            });
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

        return this.updateById(userId, {
            premiumTrafficLeft: premiumTraffic,
            mobileGbTrafficLeft: mobileGbTraffic,
            ipv6GbTrafficLeft: ipv6GbTraffic,
            premiumResidentialTrafficLeft: premiumResidentialTraffic,
            mobileTrafficLeft: mobileTraffic,
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

        // Проверяем валидность тарифа (только тарифы по ГБ)
        const validTariffs: PackageType[] = ["RESIDENT_PREMIUM", "MOBILE_GB", "IPV6_GB"];
        if (!validTariffs.includes(tariffType)) {
            throw new BadRequestException("errors.invalid_tariff_for_trial");
        }

        // Антифрод (Часть 2 ТЗ): триал только при наличии верифицированной привязки
        // Google/Telegram, которая ранее не использовала триал на другой учётке.
        const linkedAccounts = await this.prisma.account.findMany({
            where: { userId, provider: { in: ["GOOGLE", "TELEGRAM"] } },
            select: { provider: true, providerAccountId: true },
        });
        if (linkedAccounts.length === 0) {
            await this.notificationService.createOnce({
                userId,
                type: "trial_link_required",
                title: "Привяжите аккаунт для пробного периода",
                body: "Чтобы активировать триал, привяжите Google или Telegram в настройках профиля. Это защита от злоупотреблений.",
                link: "/dashboard#linked-accounts",
            });
            throw new BadRequestException("errors.trial_requires_linked_account");
        }
        const usedIdentity = await this.prisma.trialIdentity.findFirst({
            where: {
                OR: linkedAccounts.map((a) => ({ provider: a.provider, providerKey: a.providerAccountId })),
            },
        });
        if (usedIdentity && usedIdentity.usedByUserId !== userId) {
            throw new BadRequestException("errors.trial_identity_already_used");
        }

        // 100 МБ в байтах
        const trialTraffic = String(100 * 1024 * 1024);

        try {
            // Начисляем трафик и создаем пакет
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
        } catch (e: unknown) {
            // Если не удалось создать аккаунт или добавить трафик - выбрасываем ошибку
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
