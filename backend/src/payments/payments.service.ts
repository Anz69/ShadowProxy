import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, OnModuleInit } from "@nestjs/common";
import { CryptoBotProvider } from "./providers/services/crypto-bot.provider";
import { Request } from "express";
import { CryptoBotWebhookDataType } from "./providers/types/crypto-bot/crypto-bot-webhook-data.type";
import { PrismaService } from "../prisma/prisma.service";
import { Package, PackageType, PaymentProvider, PaymentStatus, Prisma, ProxyStatus, ProxyType, User } from "@prisma/client";
import axios from "axios";
import { CreateResidentInvoiceDto } from "./dtos/create-resident-invoice.dto";
import { SettingsService } from "../settings/settings.service";
import { HeleketProvider } from "./providers/services/heleket.provider";
import { HeleketWebhookData } from "./providers/types/heleket/heleket-webhook.type";
import { PaymentFactory } from "./payment-factory";
import { AvailableAssets, availableAssetsArray } from "./types/available-assets.type";
import { CreatePackageInvoiceDto } from "./dtos/create-package-invoice.dto";
import { PackageService } from "../package/package.service";
import { PaymentMetadata } from "./types/payment-metadata.type";
import { ProxyService } from "../proxy/proxy.service";
import { LoggerService } from "../logger/logger.service";
import { CreateMobileInvoiceDto } from "./dtos/create-mobile-invoice.dto";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { sleep } from "../shared/utils/sleep";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { isDev } from "../shared/utils/is-dev";
import { CreateIspInvoiceDto } from "./dtos/create-isp-invoice.dto";
import { CreateBalanceInvoiceDto } from "./dtos/create-balance-invoice.dto";
import { UserService } from "../user/user.service";
import { ReferralService } from "../referral/referral.service";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class PaymentsService implements OnModuleInit {
    public exchangeCache = new Map<string, { value: number; timestamp: number }>();

    private readonly cacheTtlMs = 300_000;

    constructor(
        private readonly cryptoBotProvider: CryptoBotProvider,
        private readonly heleketProvider: HeleketProvider,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly settingService: SettingsService,
        private readonly packageService: PackageService,
        private readonly proxyService: ProxyService,
        private readonly logger: LoggerService,
        private readonly eventEmitter: EventEmitter2,
        private readonly userService: UserService,
        private readonly referralService: ReferralService,
        private readonly notificationService: NotificationService,
    ) {}

    async onModuleInit() {
        if (isDev(this.configService)) {
            this.exchangeCache.set("USDT", { value: 1, timestamp: Date.now() });
        } else {
            try {
                await this.fetchActualExchangeRates();
            } catch (error) {
                await this.logger.log("SYSTEM", `Ошибка при инициализации курсов валют: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    async processCryptoBotWebhook(req: Request, data: CryptoBotWebhookDataType) {
        const verifyResult = this.cryptoBotProvider.verifyWebhookSignature(data, req.headers["crypto-pay-api-signature"] as string);

        if (!verifyResult) {
            throw new ForbiddenException("errors.wrong_signature");
        }

        if (data.update_type === "invoice_paid" && data.payload.status === "paid") {
            await this.prisma.$transaction(async (tx) => await this.processPaidOrder(tx, data), { timeout: 120000 });
        }
    }

    async processHeleketWebhook(data: HeleketWebhookData) {
        const verifyResult = this.heleketProvider.verifyWebhookSignature(data);

        if (!verifyResult) {
            throw new ForbiddenException("errors.wrong_signature");
        }

        if (data.status === "paid" || data.status === "paid_over") {
            await this.prisma.$transaction(async (tx) => await this.processPaidOrder(tx, data), { timeout: 120000 });
        }
    }

    async processPaidOrder(tx: Prisma.TransactionClient, data: CryptoBotWebhookDataType | HeleketWebhookData) {
        let paymentId: string;

        if ("update_id" in data) {
            paymentId = JSON.parse(data.payload.payload || "")?.paymentId;
        } else {
            paymentId = data.order_id;
        }

        const payment = await tx.payment.findUnique({
            where: {
                id: paymentId,
            },
            include: {
                user: true,
            },
        });

        if (!payment) {
            return;
        }

        // Если платеж уже оплачен, проверяем, не обработан ли он уже
        // (для оплаты с баланса платеж создается сразу со статусом PAID)
        const isAlreadyPaid = payment.status === PaymentStatus.PAID;
        
        // Проверяем, не был ли платеж уже обработан (есть ли запись в referral_rewards)
        const existingReward = await tx.referralReward.findUnique({
            where: { paymentId },
        });
        
        // Если платеж уже обработан, выходим
        if (isAlreadyPaid && existingReward) {
            return;
        }
        
        const { metadata, user } = payment;
        const { contents } = metadata as unknown as PaymentMetadata;
        const [firstContent] = contents;

        // Обновляем статус только если он еще не PAID
        if (!isAlreadyPaid) {
            await tx.payment.update({
                where: {
                    id: paymentId,
                },
                data: {
                    status: PaymentStatus.PAID,
                },
            });
        }

        // Скидка (триал/отзыв) «сгорает» при реальной оплате (Часть 1.3/2.3 ТЗ).
        // Вне гейта !isAlreadyPaid — иначе при оплате с баланса (платёж сразу PAID)
        // флаг не гасится. Установка false идемпотентна.
        {
            const discount = (metadata as any)?.discount as
                | { kind: "trial" | "review" }
                | undefined;
            if (discount && payment.userId) {
                await tx.user.update({
                    where: { id: payment.userId },
                    data:
                        discount.kind === "trial"
                            ? ({ trialDiscountAvailable: false } as any)
                            : ({ reviewDiscountAvailable: false } as any),
                });
            }
        }

        // Начисляем реферальные средства (только для тарифов по ГБ, не для баланса)
        if (firstContent.type !== "balance") {
            // Проверяем, не начислялись ли уже реферальные для этого платежа
            if (!existingReward) {
                await this.referralService.awardReferralReward(
                    payment.userId!,
                    paymentId,
                    Number(payment.amountUsd),
                    tx,
                );
            }

            // Просьба оставить отзыв — один раз после первой успешной покупки (Часть 1.1 ТЗ).
            // Работает и для крипто-оплаты, и для оплаты с баланса (там платёж сразу PAID,
            // поэтому НЕ гейтим по !isAlreadyPaid). Идемпотентность: createOnce дедупит
            // по типу уведомления + проверка !hasReview ("не спамить, один раз").
            if (payment.userId) {
                const paidCount = await tx.payment.count({
                    where: { userId: payment.userId, status: PaymentStatus.PAID },
                });
                const hasReview = await tx.review.findUnique({ where: { userId: payment.userId } });
                if (paidCount >= 1 && !hasReview) {
                    await this.notificationService.createOnce({
                        userId: payment.userId,
                        type: "review_request",
                        title: "Оставьте отзыв и получите скидку 30%",
                        body: "Спасибо за покупку! Поделитесь впечатлением — за отзыв дарим скидку 30% на следующую покупку любого пакета.",
                        link: "/reviews",
                    });
                }
            }
        }

        switch (firstContent.type) {
            case "package":
                const paidPackage = await tx.package.findUnique({
                    where: {
                        id: firstContent.packageId,
                    },
                });
                if (paidPackage) {
                    await this.logger.log(
                        "REPLENISH",
                        `Успешная покупка. Пользователь ${user!.id} успешно приобрёл пакет ${paidPackage.type === "RESIDENT" ? "резидентских" : paidPackage.type === "RESIDENT_PREMIUM" ? "премиум" : paidPackage.type === "IPV6_GB" ? "IPv6 ГБ" : paidPackage.type === "MOBILE_GB" ? "мобильных ГБ" : "мобильных"} прокси на ${paidPackage.traffic} байт`,
                        user!.id,
                        {
                            paymentId,
                            amount: payment.amountUsd,
                            type: paidPackage.type,
                        },
                    );
                    // Провижининг прокси — ВНЕ платёжной транзакции и неблокирующе:
                    // сбой/задержка Mango/ProxyEmpire не должны валить оплату или вешать запрос.
                    {
                        const pType = paidPackage.type;
                        const pTraffic = paidPackage.traffic;
                        const pUserId = payment.userId;
                        const pAccJustCreated = pType === "RESIDENT_PREMIUM" ? !user?.premiumUsername?.length : undefined;
                        const pAccId = user!.id;
                        void (async () => {
                            try {
                                await this.eventEmitter.emitAsync("proxy.create_account", { type: pType, userId: pAccId });
                                await this.eventEmitter.emitAsync("user.distribute_traffic", {
                                    tariff: pType,
                                    traffic: pTraffic,
                                    userId: pUserId,
                                    accountJustCreated: pAccJustCreated,
                                });
                            } catch (e: any) {
                                await this.logger.error(
                                    `Провижининг после оплаты (package ${pType}) сбой: ${e?.message || String(e)}`,
                                    pUserId || undefined,
                                );
                            }
                        })();
                    }
                    // Запускаем реактивацию прокси асинхронно (вне транзакции)
                    this.eventEmitter.emit("proxy.reactivate", {
                        userId: user!.id,
                        proxyType: paidPackage.type,
                    });
                }
                break;
            case "resident":
                // Legacy MOBILE_GB → новый MOBILE (PE) с прозрачным редиректом для платёжки
                // (см. задача 4 ТЗ). Старая интеграция полностью заменена.
                const effectiveTariff =
                    firstContent.tariff === "MOBILE_GB" ? "MOBILE" : firstContent.tariff;
                const tariffLabel = effectiveTariff === "RESIDENT"
                    ? "резидентских"
                    : effectiveTariff === "RESIDENT_PREMIUM"
                        ? "премиум"
                        : effectiveTariff === "MOBILE"
                            ? "мобильных"
                            : effectiveTariff === "IPV6_GB"
                                ? "IPv6 ГБ"
                                : "прокси";
                await this.logger.log(
                    "REPLENISH",
                    `Успешное пополнение. Пользователь ${user!.id} успешно пополнил свой баланс ${tariffLabel} прокси на ${firstContent.traffic} Гб`,
                    user!.id,
                    {
                        paymentId,
                        amount: payment.amountUsd,
                        type: effectiveTariff,
                        originalTariff: firstContent.tariff,
                    },
                );
                // Провижининг прокси — ВНЕ платёжной транзакции и неблокирующе
                // (сбой/задержка Mango/ProxyEmpire не валит оплату и не вешает запрос).
                {
                    const rTariff = effectiveTariff;
                    const rTraffic = String(BigInt(Math.round(Number(firstContent.traffic) * 1024 ** 3)));
                    const rUserId = payment.userId;
                    const rAccId = user!.id;
                    const rAccJustCreated = effectiveTariff === "RESIDENT_PREMIUM" ? !user?.premiumUsername?.length : undefined;
                    void (async () => {
                        try {
                            await this.eventEmitter.emitAsync("proxy.create_account", { type: rTariff, userId: rAccId });
                            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                                tariff: rTariff,
                                traffic: rTraffic,
                                userId: rUserId,
                                accountJustCreated: rAccJustCreated,
                            });
                        } catch (e: any) {
                            await this.logger.error(
                                `Провижининг после оплаты (resident ${rTariff}) сбой: ${e?.message || String(e)}`,
                                rUserId || undefined,
                            );
                        }
                    })();
                }
                // Запускаем реактивацию прокси асинхронно (вне транзакции)
                this.eventEmitter.emit("proxy.reactivate", {
                    userId: user!.id,
                    proxyType: effectiveTariff,
                });
                break;
            case "isp":
                await this.logger.log(
                    "REPLENISH",
                    `Успешное пополнение. Пользователь ${user!.id} успешно пополнил свой баланс IPv6 ГБ прокси на ${firstContent.quantity} IP`,
                    user!.id,
                    {
                        paymentId,
                        amount: payment.amountUsd,
                        type: "IPV6_GB",
                    },
                );
                // Создаем UserPackage если его еще нет (для редиректа) — быстрая DB-операция
                await this.packageService.createPackageIfNotExists("IPV6_GB", "0", user!.id);
                // Провижининг аккаунта — ВНЕ транзакции, неблокирующе
                {
                    const ispAccId = user!.id;
                    const ispUserId = payment.userId;
                    void (async () => {
                        try {
                            await this.eventEmitter.emitAsync("proxy.create_account", { type: "IPV6_GB", userId: ispAccId });
                        } catch (e: any) {
                            await this.logger.error(
                                `Провижининг после оплаты (isp IPV6_GB) сбой: ${e?.message || String(e)}`,
                                ispUserId || undefined,
                            );
                        }
                    })();
                }
                // Для ISP не распределяем трафик, так как это количество IP, а не трафик
                // Трафик будет списываться при создании прокси через issueIspProxy
                break;
            case "mobile":
                await this.logger.log("REPLENISH", `Успешная покупка. Пользователь ${user!.id} успешно приобрёл мобильные прокси на ${firstContent.rentTime} секунд`, user!.id, {
                    paymentId,
                    amount: payment.amountUsd,
                    type: "MOBILE",
                });
                
                if (!payment.userId) {
                    throw new BadRequestException("errors.user_not_found");
                }
                
                // Всегда создаем Package с типом MOBILE
                const mobilePackage = await tx.package.create({
                    data: {
                        type: "MOBILE",
                        traffic: "0", // Для мобильных прокси трафик не используется
                        price: payment.amountUsd,
                    },
                });
                
                // Проверяем, есть ли userPackageId в metadata (пополнение существующего пакета)
                const userPackageId = (firstContent as any).userPackageId;
                
                if (userPackageId) {
                    // Пополнение существующего пакета
                    const existingUserPackage = await tx.userPackage.findUnique({
                        where: { id: userPackageId },
                    });
                    
                    if (!existingUserPackage || existingUserPackage.userId !== payment.userId) {
                        throw new BadRequestException("errors.package_not_found");
                    }
                    
                    const pkg = existingUserPackage as any;
                    const now = new Date();
                    const expirationTime = pkg.rentTime && pkg.createdAt 
                        ? new Date(pkg.createdAt.getTime() + pkg.rentTime * 1000)
                        : null;
                    
                    // Если время еще не истекло - добавляем к существующему rentTime
                    // Если истекло - устанавливаем новое время (сбрасываем createdAt)
                    let newRentTime: number;
                    let shouldResetCreatedAt = false;
                    
                    if (expirationTime && now < expirationTime) {
                        // Время еще не истекло - добавляем новое время к оставшемуся
                        const remainingSeconds = Math.floor((expirationTime.getTime() - now.getTime()) / 1000);
                        newRentTime = remainingSeconds + firstContent.rentTime;
                    } else {
                        // Время истекло или его не было - устанавливаем новое время
                        newRentTime = firstContent.rentTime;
                        shouldResetCreatedAt = true;
                    }
                    
                    // Обновляем UserPackage
                    if (shouldResetCreatedAt) {
                        await tx.$executeRawUnsafe(`
                            UPDATE user_packages 
                            SET rent_time = $1,
                                plan_id = $2,
                                created_at = NOW(),
                                updated_at = NOW()
                            WHERE id = $3
                        `, newRentTime, firstContent.plan, userPackageId);
                        
                        // Если время было переустановлено, активируем все suspended прокси этого пакета
                        await tx.proxy.updateMany({
                            where: {
                                userPackageId: userPackageId,
                                status: ProxyStatus.SUSPENDED,
                            },
                            data: {
                                status: ProxyStatus.ACTIVE,
                            },
                        });
                    } else {
                        await tx.$executeRawUnsafe(`
                            UPDATE user_packages 
                            SET rent_time = $1,
                                plan_id = $2,
                                updated_at = NOW()
                            WHERE id = $3
                        `, newRentTime, firstContent.plan, userPackageId);
                        
                        // Проверяем и активируем все прокси пакета, если они были приостановлены
                        await tx.proxy.updateMany({
                            where: {
                                userPackageId: userPackageId,
                                status: ProxyStatus.SUSPENDED,
                            },
                            data: {
                                status: ProxyStatus.ACTIVE,
                            },
                        });
                    }
                } else {
                    // Создание нового пакета
                    // Проверяем, существует ли UserPackage для этого пользователя
                    const existingUserPackage = await tx.userPackage.findUnique({
                        where: {
                            userId_type: {
                                userId: payment.userId,
                                type: "MOBILE" as any,
                            },
                        },
                    });
                    
                    if (existingUserPackage) {
                        // Обновляем существующий UserPackage
                        await tx.$executeRawUnsafe(`
                            UPDATE user_packages 
                            SET rent_time = $1,
                                plan_id = $2,
                                created_at = NOW(),
                                updated_at = NOW()
                            WHERE id = $3
                        `, firstContent.rentTime, firstContent.plan, existingUserPackage.id);
                    } else {
                        // Создаем новый UserPackage
                        await tx.$executeRawUnsafe(`
                            INSERT INTO user_packages (id, user_id, type, rent_time, plan_id, created_at, updated_at)
                            VALUES (gen_random_uuid(), $1, 'MOBILE', $2, $3, NOW(), NOW())
                        `, payment.userId, firstContent.rentTime, firstContent.plan);
                    }
                }
                
                // Сохраняем ID Package в metadata для возврата в buildAndSaveInvoice
                await tx.payment.update({
                    where: { id: paymentId },
                    data: {
                        metadata: {
                            ...(payment.metadata as any),
                            mobilePackageId: mobilePackage.id,
                        },
                    },
                });
                break;
            case "balance":
                await this.logger.log("REPLENISH", `Успешное пополнение баланса. Пользователь ${user!.id} пополнил баланс на ${firstContent.amount}$`, user!.id, {
                    paymentId,
                    amount: payment.amountUsd,
                    type: "BALANCE",
                });
                await tx.user.update({
                    where: {
                        id: user!.id,
                    },
                    data: {
                        balance: {
                            increment: payment.amountUsd,
                        },
                    },
                });
                break;
            default:
                await this.logger.error("Получен неизвестный тип платежа при получении вебхука");
                break;
        }
    }

    /**
     * Цены за ГБ из `proxy_tariffications` — те же ключи, что пишет админка `modifyPrices`
     * (`resident_premium`, `mobile_gb`, `ipv6_gb`). Для старых БД без `resident_premium` допускается fallback на `resident`.
     */
    private readGbPriceUsdFromAdminTariffications(
        tariff: CreateResidentInvoiceDto["tariff"],
        tariffications: unknown,
    ): { priceUsdPerGb: number; settingKey: string } {
        const adminKeyByTariff: Record<CreateResidentInvoiceDto["tariff"], string> = {
            RESIDENT_PREMIUM: "resident_premium",
            MOBILE_GB: "mobile_gb",
            IPV6_GB: "ipv6_gb",
            PREMIUM_RESIDENTIAL: "premium_residential",
            MOBILE: "mobile_gb", // новый MOBILE использует ту же цену что mobile_gb
        };
        // Дефолтные цены если в админке не настроены — чтобы покупка не падала
        const fallbackPriceByKey: Record<string, number> = {
            resident_premium: 1.2,
            premium_residential: 1.5,
            mobile_gb: 0.5,
            ipv6_gb: 5.0,
        };
        const adminKey = adminKeyByTariff[tariff];

        const raw = (tariffications && typeof tariffications === "object")
            ? (tariffications as Record<string, unknown>)
            : ({} as Record<string, unknown>);

        let priceUsdPerGb = Number(raw[adminKey]);
        let settingKey = adminKey;

        if (!(Number.isFinite(priceUsdPerGb) && priceUsdPerGb > 0) && tariff === "RESIDENT_PREMIUM") {
            const legacy = Number(raw["resident"]);
            if (Number.isFinite(legacy) && legacy > 0) {
                priceUsdPerGb = legacy;
                settingKey = "resident (legacy fallback, в админке используйте resident_premium)";
            }
        }

        // Fallback на дефолтное значение, если в админке цена не выставлена
        if (!(Number.isFinite(priceUsdPerGb) && priceUsdPerGb > 0)) {
            const fallback = fallbackPriceByKey[adminKey];
            if (Number.isFinite(fallback) && fallback > 0) {
                priceUsdPerGb = fallback;
                settingKey = `${adminKey} (default fallback ${fallback}$)`;
                console.warn(
                    `[Payments] цена ${tariff} не задана в админке → используем default ${fallback}$/Гб (proxy_tariffications.${adminKey})`,
                );
            }
        }

        if (!(Number.isFinite(priceUsdPerGb) && priceUsdPerGb > 0)) {
            console.error(
                `[Payments] нет цены ${tariff} → proxy_tariffications.${adminKey}; ключи: ${Object.keys(raw).join(",")}`,
            );
            throw new InternalServerErrorException("errors.proxy_gb_price_not_set");
        }

        return { priceUsdPerGb, settingKey };
    }

    async createResidentInvoice(dto: CreateResidentInvoiceDto, userId: string) {
        const tariffications = await this.settingService.getValue<Record<string, unknown>>("proxy_tariffications");
        const { priceUsdPerGb } = this.readGbPriceUsdFromAdminTariffications(dto.tariff, tariffications);
        const trafficFiatPrice = dto.traffic * priceUsdPerGb;

        if (trafficFiatPrice < 0.5 && dto.merchant === "HELEKET") {
            throw new BadRequestException("errors.too_small_amount");
        }

        return this.buildAndSaveInvoice(
            {
                asset: dto.asset,
                merchant: dto.merchant,
                amountUsd: trafficFiatPrice,
                contents: [
                    {
                        type: "resident",
                        tariff: dto.tariff,
                        traffic: dto.traffic,
                    },
                ],
            },
            userId,
        );
    }

    async createISPInvoice(dto: CreateIspInvoiceDto, userId: string) {
        const tariffications = await this.settingService.getValue<Record<string, unknown>>("proxy_tariffications");
        const ispUnit = Number(tariffications && typeof tariffications === "object" ? tariffications["isp"] : NaN);

        if (!Number.isFinite(ispUnit) || ispUnit <= 0) {
            console.error("[Payments] createISPInvoice: нужен proxy_tariffications.isp (в админке «Цены» isp не задаётся — только через settings).");
            throw new InternalServerErrorException("errors.proxy_gb_price_not_set");
        }

        const proxiesPrice = dto.quantity * ispUnit;

        if (proxiesPrice < 0.5 && dto.merchant === "HELEKET") {
            throw new BadRequestException("errors.too_small_amount");
        }

        return this.buildAndSaveInvoice(
            {
                asset: dto.asset,
                merchant: dto.merchant,
                amountUsd: proxiesPrice,
                contents: [
                    {
                        type: "isp",
                        quantity: dto.quantity,
                    },
                ],
            },
            userId,
        );
    }

    async createPackageInvoice(dto: CreatePackageInvoiceDto, userId: string) {
        const requestedPackage = await this.packageService.findById(dto.package);

        if (!requestedPackage) {
            throw new NotFoundException("errors.package_not_found");
        }

        if (Number(requestedPackage.price) < 0.5 && dto.merchant === "HELEKET") {
            throw new BadRequestException("errors.too_small_amount");
        }

        return this.buildAndSaveInvoice(
            {
                asset: dto.asset,
                merchant: dto.merchant,
                amountUsd: Number(requestedPackage.price),
                contents: [
                    {
                        type: "package",
                        packageId: dto.package,
                    },
                ],
            },
            userId,
        );
    }

    async createMobileInvoice(dto: CreateMobileInvoiceDto, userId: string) {
        const plan = this.proxyService.availableMobileProxyPlans.find((el) => el.id === dto.planId);

        if (!plan) {
            throw new BadRequestException("errors.unknown_mobile_proxy_plan");
        }

        const rentTime = await this.settingService.getValue<{
            options: { rentTime: number; price: number }[];
        }>("mobile_tariffications");

        const rentOption = rentTime?.options?.find((el) => el.rentTime === dto.rentTime);
        if (!rentTime?.options?.length || !rentOption) {
            console.error(`[Payments] createMobileInvoice: нет mobile_tariffications или rentTime=${dto.rentTime}.`);
            throw new BadRequestException("errors.unknown_mobile_proxy_rent_time");
        }

        if (rentOption.price < 0.5 && dto.merchant === "HELEKET") {
            throw new BadRequestException("errors.too_small_amount");
        }

        return this.buildAndSaveInvoice(
            {
                asset: dto.asset,
                merchant: dto.merchant,
                amountUsd: rentOption.price,
                contents: [
                    {
                        type: "mobile",
                        plan: dto.planId,
                        rentTime: dto.rentTime,
                        userPackageId: dto.userPackageId,
                    },
                ],
            },
            userId,
        );
    }

    async createBalanceInvoice(dto: CreateBalanceInvoiceDto, userId: string) {
        if (dto.amount < 0.5 && dto.merchant === "HELEKET") {
            throw new BadRequestException("errors.too_small_amount");
        }

        if (dto.merchant === "BALANCE" || dto.merchant === "REFERRAL_BALANCE") {
            throw new BadRequestException("errors.cannot_use_balance_for_replenish");
        }

        return this.buildAndSaveInvoice(
            {
                asset: dto.asset,
                merchant: dto.merchant,
                amountUsd: dto.amount,
                contents: [
                    {
                        type: "balance",
                        amount: dto.amount,
                    },
                ],
            },
            userId,
        );
    }

    /**
     * Скидка за отзыв (Часть 1.3 ТЗ): есть reviewDiscountAvailable.
     * Пополнение баланса (type=balance) скидке не подлежит. Единоразовая.
     */
    private async computeDiscount(
        userId: string,
        contents: PaymentMetadata["contents"],
    ): Promise<{ kind: "trial" | "review"; pct: number } | null> {
        const [firstContent] = contents;
        if (!firstContent || firstContent.type === "balance") return null;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { trialDiscountAvailable: true, reviewDiscountAvailable: true } as any,
        });
        if (!user) return null;
        const u = user as any;
        if (!u.trialDiscountAvailable && !u.reviewDiscountAvailable) return null;

        const paidCount = await this.prisma.payment.count({
            where: { userId, status: PaymentStatus.PAID },
        });
        const hasPaid = paidCount > 0;

        const discounts = await this.settingService.getDiscounts();
        // Триал-скидка — до первой покупки, отзыв-скидка — после (Часть 1.3/2.3 ТЗ).
        if (u.trialDiscountAvailable && !hasPaid) return { kind: "trial", pct: discounts.trial };
        if (u.reviewDiscountAvailable && hasPaid) return { kind: "review", pct: discounts.review };
        return null;
    }

    /** Активная скидка юзера для отображения на странице оплаты (Часть 1.3/2.3 ТЗ). */
    async getActiveDiscountForUser(userId: string): Promise<{ kind: "trial" | "review"; pct: number } | null> {
        return this.computeDiscount(userId, [{ type: "resident" } as any]);
    }

    private async buildAndSaveInvoice(
        dto: {
            asset: AvailableAssets;
            merchant: PaymentProvider;
            amountUsd: number;
            contents: PaymentMetadata["contents"];
        },
        userId: string,
    ) {
        // Применяем скидку (если есть) к финальной сумме инвойса.
        const picked = await this.computeDiscount(userId, dto.contents);
        let discountMeta: { kind: "trial" | "review"; pct: number; originalUsd: number } | undefined;
        if (picked && picked.pct > 0) {
            const originalUsd = dto.amountUsd;
            dto.amountUsd = Math.round(originalUsd * (1 - picked.pct / 100) * 100) / 100;
            discountMeta = { kind: picked.kind, pct: picked.pct, originalUsd };
        }

        // Если оплата с баланса или реферального баланса - обрабатываем сразу
        if (dto.merchant === PaymentProvider.BALANCE || dto.merchant === PaymentProvider.REFERRAL_BALANCE) {
            const user = await this.userService.findById(userId, true, false);
            if (!user) {
                throw new NotFoundException("errors.user_not_found");
            }

            const balance = dto.merchant === PaymentProvider.BALANCE 
                ? Number(user.balance) 
                : Number(user.referralBalance);

            if (balance < dto.amountUsd) {
                throw new BadRequestException("errors.insufficient_balance");
            }

            // Создаем платеж
            const payment = PaymentFactory.create()
                .withAmount(dto.amountUsd)
                .withAmountUsd(dto.amountUsd)
                .withAsset(dto.asset)
                .withContents(dto.contents)
                .withProvider(dto.merchant)
                .forUser(userId)
                .withDiscount(discountMeta)
                .build();

            // Сохраняем платеж
            const savedPayment = await this.create({
                ...payment,
                status: PaymentStatus.PAID,
                paymentUrl: null,
            });

            // Списываем средства
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    [dto.merchant === PaymentProvider.BALANCE ? "balance" : "referralBalance"]: {
                        decrement: new Prisma.Decimal(dto.amountUsd),
                    },
                },
            });

            // Обрабатываем оплаченный платеж в транзакции (timeout 30s — emitAsync вызывает Luna/Mango API)
            await this.prisma.$transaction(
                async (tx) => {
                    const fakeWebhookData: HeleketWebhookData = {
                        type: "payment",
                        uuid: "",
                        order_id: savedPayment.id,
                        amount: String(dto.amountUsd),
                        payment_amount: String(dto.amountUsd),
                        payment_amount_usd: String(dto.amountUsd),
                        merchant_amount: String(dto.amountUsd),
                        commission: "0",
                        is_final: true,
                        status: "paid",
                        from: "",
                        network: dto.asset,
                        currency: dto.asset as AvailableAssets,
                        payer_currency: dto.asset as AvailableAssets,
                        payer_amount: String(dto.amountUsd),
                        payer_amount_exchange_rate: "1",
                        txid: `balance-${Date.now()}`,
                        sign: "balance-payment",
                    };
                    await this.processPaidOrder(tx, fakeWebhookData);
                },
                { timeout: 120000 }
            );

            // Находим UserPackage для редиректа (если это resident, isp, mobile_gb или mobile)
            const [firstContent] = dto.contents;
            let userPackageId: string | null = null;
            
            if (firstContent.type === "resident" || firstContent.type === "isp") {
                const tariff = firstContent.type === "isp" ? "IPV6_GB" : (firstContent as any).tariff;
                if (tariff && ["RESIDENT_PREMIUM", "MOBILE_GB", "IPV6_GB", "PREMIUM_RESIDENTIAL", "MOBILE"].includes(tariff)) {
                    const userPackage = await this.prisma.userPackage.findUnique({
                        where: {
                            userId_type: {
                                userId,
                                type: tariff as any,
                            },
                        },
                    });
                    if (userPackage) {
                        userPackageId = userPackage.id;
                    }
                }
            } else if (firstContent.type === "mobile") {
                // Если есть userPackageId в metadata - используем его (пополнение существующего пакета)
                if (firstContent.userPackageId) {
                    userPackageId = firstContent.userPackageId;
                } else {
                    // Ищем UserPackage для mobile
                    const userPackage = await this.prisma.userPackage.findUnique({
                        where: {
                            userId_type: {
                                userId,
                                type: "MOBILE" as any,
                            },
                        },
                    });
                    if (userPackage) {
                        userPackageId = userPackage.id;
                    }
                }
            } else if (firstContent.type === "package") {
                const packageData = await this.prisma.package.findUnique({
                    where: { id: (firstContent as any).packageId },
                });
                if (packageData) {
                    const userPackage = await this.prisma.userPackage.findUnique({
                        where: {
                            userId_type: {
                                userId,
                                type: packageData.type,
                            },
                        },
                    });
                    if (userPackage) {
                        userPackageId = userPackage.id;
                    }
                }
            }

            // Возвращаем payment с userPackageId
            return {
                ...savedPayment,
                userPackageId,
            } as any;
        }

        // Обычная оплата через мерчанта
        const exchangeRate = await this.getExchangeRate(dto.asset);
        const amountCrypto = dto.amountUsd / exchangeRate;

        const payment = PaymentFactory.create()
            .withAmount(amountCrypto)
            .withAmountUsd(dto.amountUsd)
            .withAsset(dto.asset)
            .withContents(dto.contents)
            .withProvider(dto.merchant)
            .forUser(userId)
            .withDiscount(discountMeta)
            .build();

        return this.finalInvoice(payment);
    }

    async finalInvoice(payment: Prisma.PaymentCreateInput) {
        const invoiceDto = {
            paymentId: String(payment.id),
            asset: payment.asset as AvailableAssets,
            amount: String(Number(payment.amount)),
        };
        const provider = payment.provider as PaymentProvider;

        let providerInvoice: { pay_url?: string; url?: string };
        try {
            providerInvoice =
                provider === PaymentProvider.CRYPTO_BOT
                    ? await this.cryptoBotProvider.createInvoice(invoiceDto)
                    : await this.heleketProvider.createInvoice(invoiceDto);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[Payments] ${provider} paymentId=${invoiceDto.paymentId} ${msg}`);
            throw err;
        }

        await this.logger.log(
            "SYSTEM",
            `Создан платёж на сумму ${Number(payment.amount)} ${payment.asset} | ${Number(payment.amountUsd)} USD для провайдера ${payment.provider}`,
            payment.user?.connect?.id,
            invoiceDto,
        );
        return this.create({
            ...payment,
            paymentUrl: "pay_url" in providerInvoice ? providerInvoice.pay_url : providerInvoice.url,
        });
    }

    async create(data: Prisma.PaymentCreateInput) {
        return this.prisma.payment.create({
            data,
        });
    }

    async findManyByUserId(userId: string) {
        return this.prisma.payment.findMany({
            where: {
                userId,
            },
        });
    }

    async getExchangeRate(asset: string) {
        const key = asset.toUpperCase();

        if (["USDT", "USDC"].includes(key)) {
            return 1;
        }

        const cached = this.exchangeCache.get(key);
        const now = Date.now();

        if (cached && now - cached.timestamp < this.cacheTtlMs) {
            return cached.value;
        }

        try {
            const { data } = await axios.get<{
                symbol: string;
                price: string;
            }>(`https://api.binance.com/api/v3/ticker/price?symbol=${key}USDT`);
            const rate = Number(data.price);

            this.exchangeCache.set(key, { value: rate, timestamp: now });

            await this.logger.log("SYSTEM", "Успешно обновлены курсы валют.");

            return rate;
        } catch (err: unknown) {
            console.error(`[Payments/ExchangeRate] ${key}USDT: ${err instanceof Error ? err.message : String(err)}`);
            throw new InternalServerErrorException("errors.unknown_error_payment");
        }
    }

    async testCompletePayment(paymentId: string) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { user: true },
        });

        if (!payment) {
            throw new NotFoundException("errors.payment_not_found");
        }

        if (payment.status === PaymentStatus.PAID) {
            return { message: "Payment already paid", payment };
        }

        // Симулируем webhook данные
        const fakeWebhookData: HeleketWebhookData = {
            type: "payment",
            uuid: "",
            order_id: paymentId,
            amount: String(payment.amount),
            payment_amount: String(payment.amount),
            payment_amount_usd: String(payment.amountUsd),
            merchant_amount: String(payment.amount),
            commission: "0",
            is_final: true,
            status: "paid",
            from: "",
            network: payment.asset,
            currency: payment.asset as AvailableAssets,
            payer_currency: payment.asset as AvailableAssets,
            payer_amount: String(payment.amount),
            payer_amount_exchange_rate: "1",
            txid: `test-${Date.now()}`,
            sign: "test-signature",
        };

        // Обрабатываем платеж напрямую, минуя проверку подписи
        await this.prisma.$transaction(async (tx) => await this.processPaidOrder(tx, fakeWebhookData), { timeout: 120000 });

        return { message: "Payment completed successfully", payment: await this.prisma.payment.findUnique({ where: { id: paymentId } }) };
    }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async fetchActualExchangeRates() {
        const now = Date.now();
        let successCount = 0;
        let errorCount = 0;

        for (const asset of availableAssetsArray.filter((el) => !el.startsWith("usd")).map((el) => el.toUpperCase())) {
            try {
                const { data } = await axios.get<{
                    symbol: string;
                    price: string;
                }>(`https://api.binance.com/api/v3/ticker/price?symbol=${asset}USDT`);
                const rate = Number(data.price);
                if (Number.isFinite(rate) && rate > 0) {
                    this.exchangeCache.set(asset, { value: rate, timestamp: now });
                    successCount++;
                } else {
                    await this.logger.log("SYSTEM", `Получен некорректный курс для ${asset}: ${rate}`);
                    errorCount++;
                }
            } catch (error) {
                await this.logger.log("SYSTEM", `Ошибка при получении курса для ${asset}: ${error instanceof Error ? error.message : String(error)}`);
                errorCount++;
            }
            await sleep(500);
        }

        if (successCount > 0) {
            await this.logger.log("SYSTEM", `Успешно обновлены курсы валют. Обновлено: ${successCount}, Ошибок: ${errorCount}`);
        } else if (errorCount > 0) {
            await this.logger.log("SYSTEM", `Не удалось обновить курсы валют. Все запросы завершились с ошибкой (${errorCount})`);
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async cancelOldTransactions() {
        const ageSec = Number(this.configService.getOrThrow<number>("PAYMENT_LIFETIME") ?? 3600);
        if (!Number.isFinite(ageSec) || ageSec <= 0) return 0;
        const cutoff = new Date(Date.now() - ageSec * 1000);
        const { count } = await this.prisma.payment.updateMany({
            where: { status: PaymentStatus.WAITING, createdAt: { lt: cutoff } },
            data: { status: PaymentStatus.CANCELLED },
        });
        return count;
    }
}
