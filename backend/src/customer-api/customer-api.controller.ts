import { Controller, Get, Post, HttpCode, HttpStatus, UseFilters, Body, Param, Query, BadRequestException, NotFoundException, HttpException, Req } from "@nestjs/common";
import type { Request } from "express";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CustomerApiKey } from "./decorators/customer-api-key.decorator";
import { Customer } from "./decorators/customer.decorator";
import { CustomerApiKeyExceptionFilter } from "./filters/customer-api-key-exception.filter";
import { ApiSuccessResponse, ApiErrorResponse } from "./types/api-response.types";
import type { User, PackageType } from "@prisma/client";
import { PackageService } from "../package/package.service";
import { ProxyService } from "../proxy/proxy.service";
import { UserService } from "../user/user.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { LoggerService } from "../logger/logger.service";
import { CreatePackageDto } from "./dtos/create-package.dto";
import { CreateProxyDto } from "./dtos/create-proxy.dto";
import { PurchaseTrafficDto } from "./dtos/purchase-traffic.dto";
import { PurchaseMobileTimeDto } from "./dtos/purchase-mobile-time.dto";
import { ApiErrorCode } from "./exceptions/api-error-codes";
import { Decimal } from "@prisma/client/runtime/library";

@Controller("user-api")
@UseFilters(CustomerApiKeyExceptionFilter)
export class CustomerApiController {
    constructor(
        private readonly packageService: PackageService,
        private readonly proxyService: ProxyService,
        private readonly userService: UserService,
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
        private readonly logger: LoggerService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private getApiToken(req: Request): string {
        const header = req.headers["api-key"] || req.headers["authorization"];
        if (header) {
            const headerValue = Array.isArray(header) ? header[0] : header;
            if (typeof headerValue === "string" && headerValue.startsWith("Bearer ")) {
                return headerValue.substring(7);
            } else if (typeof headerValue === "string") {
                return headerValue;
            }
        }
        return "unknown";
    }

    private async logApiCall(req: Request, endpoint: string, httpStatus: number, responseTime: number, userId?: string, errorMessage?: string) {
        const apiToken = this.getApiToken(req);
        const ipAddress = req.ip || (Array.isArray(req.headers["x-forwarded-for"]) ? req.headers["x-forwarded-for"][0] : req.headers["x-forwarded-for"]) || req.socket.remoteAddress || "unknown";
        await this.logger.logApi({
            endpoint,
            httpStatus,
            responseTime,
            ipAddress: typeof ipAddress === "string" ? ipAddress : String(ipAddress),
            userId,
            requestBody: this.sanitizeRequestBody(req.body),
            responseBody: undefined, // Не логируем ответы для User API
            errorMessage,
            metadata: {
                apiToken: apiToken.substring(0, 8) + "***", // Показываем только первые 8 символов
            },
        });
    }

    private sanitizeRequestBody(body: any): any {
        if (!body) return body;
        const sanitized = { ...body };
        if (sanitized.password) sanitized.password = '[REDACTED]';
        if (sanitized.newPassword) sanitized.newPassword = '[REDACTED]';
        if (sanitized.oldPassword) sanitized.oldPassword = '[REDACTED]';
        if (sanitized.apiKey) sanitized.apiKey = '[REDACTED]';
        return sanitized;
    }

    @Get("status")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async getStatus(@Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<{ active: boolean; message: string }>> {
        const startTime = Date.now();
        try {
            const result: ApiSuccessResponse<{ active: boolean; message: string }> = {
                status: "ok",
                code: "200",
                message: {
                    active: true,
                    message: "API ключ активен",
                },
            };
            await this.logApiCall(req, "GET /api/user-api/status", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            await this.logApiCall(req, "GET /api/user-api/status", HttpStatus.INTERNAL_SERVER_ERROR, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }

    @Get("balance")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async getBalance(@Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<{ balance: string; referralBalance: string }>> {
        const startTime = Date.now();
        try {
            const result: ApiSuccessResponse<{ balance: string; referralBalance: string }> = {
                status: "ok",
                code: "200",
                message: {
                    balance: user.balance.toString(),
                    referralBalance: user.referralBalance.toString(),
                },
            };
            await this.logApiCall(req, "GET /api/user-api/balance", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            await this.logApiCall(req, "GET /api/user-api/balance", HttpStatus.INTERNAL_SERVER_ERROR, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }

    @Get("packages")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async getPackages(@Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<any[]>> {
        const startTime = Date.now();
        try {
            const packages = await this.packageService.getUserPackages(user.id);
            const result: ApiSuccessResponse<any[]> = {
                status: "ok",
                code: "200",
                message: packages,
            };
            await this.logApiCall(req, "GET /api/user-api/packages", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            await this.logApiCall(req, "GET /api/user-api/packages", HttpStatus.INTERNAL_SERVER_ERROR, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }

    @Get("tariffs")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async getTariffs(@Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<any>> {
        const startTime = Date.now();
        try {
        // Получаем цены из настроек
        const proxyTariffications = await this.settingsService.getValue<{
            resident_premium?: number;
            mobile_gb?: number;
            ipv6_gb?: number;
        }>("proxy_tariffications");

        const mobileTariffications = await this.settingsService.getValue<{
            options?: { price: number; rentTime: number }[];
        }>("mobile_tariffications");

        // Получаем пакеты из БД для цен по пакетам
        const packages = await this.prisma.package.findMany({
            orderBy: {
                price: "asc",
            },
        });

        const tariffs = [
            {
                type: "RESIDENT_PREMIUM",
                name: "Residential Proxy",
                description: "Резидентские прокси по ГБ",
                pricePerGb: proxyTariffications?.resident_premium ?? 1.2,
                packages: packages.filter(p => p.type === "RESIDENT_PREMIUM").map(p => ({
                    id: p.id,
                    traffic: p.traffic,
                    price: Number(p.price),
                })),
            },
            {
                type: "IPV6_GB",
                name: "IPv6 Proxy",
                description: "IPv6 прокси по ГБ",
                pricePerGb: proxyTariffications?.ipv6_gb ?? 5.0,
                packages: packages.filter(p => p.type === "IPV6_GB").map(p => ({
                    id: p.id,
                    traffic: p.traffic,
                    price: Number(p.price),
                })),
            },
            {
                type: "MOBILE_GB",
                name: "Mobile Proxy GB",
                description: "Мобильные прокси по ГБ",
                pricePerGb: proxyTariffications?.mobile_gb ?? 0.5,
                packages: packages.filter(p => p.type === "MOBILE_GB").map(p => ({
                    id: p.id,
                    traffic: p.traffic,
                    price: Number(p.price),
                })),
            },
            {
                type: "MOBILE",
                name: "Mobile Proxy",
                description: "Мобильные прокси по времени",
                pricePer5Min: mobileTariffications?.options?.find(o => o.rentTime === 300)?.price ?? 0.25,
                options: mobileTariffications?.options ?? [],
            },
        ];

            const result: ApiSuccessResponse<any> = {
                status: "ok",
                code: "200",
                message: tariffs,
            };
            await this.logApiCall(req, "GET /api/user-api/tariffs", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            await this.logApiCall(req, "GET /api/user-api/tariffs", HttpStatus.INTERNAL_SERVER_ERROR, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }

    @Post("packages")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async createPackage(@Body() dto: CreatePackageDto, @Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<any>> {
        const startTime = Date.now();
        try {
            const userPackage = await this.packageService.activatePackageByType(dto.type, user.id);
            const result: ApiSuccessResponse<any> = {
                status: "ok",
                code: "200",
                message: userPackage,
            };
            await this.logApiCall(req, "POST /api/user-api/packages", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            const status = error.message?.includes("уже активирован") || error.message?.includes("already") ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
            await this.logApiCall(req, "POST /api/user-api/packages", status, Date.now() - startTime, user.id, error.message);
            if (error.message?.includes("уже активирован") || error.message?.includes("already")) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.PACKAGE_ALREADY_EXISTS,
                    message: "Пакет этого типа уже существует",
                } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
            }
            throw error;
        }
    }

    @Post("purchase-traffic")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async purchaseTraffic(@Body() dto: PurchaseTrafficDto, @Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<any>> {
        const startTime = Date.now();
        try {
            // Получаем цену за ГБ из настроек
            const proxyTariffications = await this.settingsService.getValue<{
                resident_premium?: number;
                mobile_gb?: number;
                ipv6_gb?: number;
            }>("proxy_tariffications");

            let pricePerGb: number;

            if (dto.type === "RESIDENT_PREMIUM") {
                pricePerGb = proxyTariffications?.resident_premium ?? 1.2;
            } else if (dto.type === "MOBILE_GB") {
                pricePerGb = proxyTariffications?.mobile_gb ?? 0.5;
            } else if (dto.type === "IPV6_GB") {
                pricePerGb = proxyTariffications?.ipv6_gb ?? 5.0;
            } else {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.INVALID_PACKAGE_TYPE,
                    message: "Неверный тип пакета. Доступны: RESIDENT_PREMIUM, MOBILE_GB, IPV6_GB",
                } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
            }

            const trafficBytes = String(BigInt(dto.amountGb) * 1024n ** 3n);

            // Если в каталоге есть пакет (бонусный/фиксированный) с тем же типом и объёмом трафика в байтах — цена как у этого пакета
            const catalogPackage = await this.prisma.package.findFirst({
                where: {
                    type: dto.type,
                    traffic: trafficBytes,
                },
                orderBy: { price: "asc" },
            });

            const totalCost = catalogPackage ? Number(catalogPackage.price) : pricePerGb * dto.amountGb;

            const currentUser = await this.prisma.user.findUnique({ where: { id: user.id } });
            if (!currentUser) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.INVALID_API_KEY,
                    message: "Пользователь не найден",
                } as ApiErrorResponse, HttpStatus.UNAUTHORIZED);
            }

            if (dto.balanceSource === "BALANCE") {
                if (Number(currentUser.balance) < totalCost) {
                    throw new HttpException({
                        status: "error",
                        code: ApiErrorCode.INSUFFICIENT_BALANCE,
                        message: `Недостаточно средств на основном балансе. Требуется: $${totalCost.toFixed(2)}, доступно: $${Number(currentUser.balance).toFixed(2)}`,
                    } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
                }
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { balance: new Decimal(currentUser.balance).minus(totalCost) },
                });
            } else {
                const ref = Number(currentUser.referralBalance ?? 0);
                if (ref < totalCost) {
                    throw new HttpException({
                        status: "error",
                        code: ApiErrorCode.INSUFFICIENT_REFERRAL_BALANCE,
                        message: `Недостаточно средств на реферальном балансе. Требуется: $${totalCost.toFixed(2)}, доступно: $${ref.toFixed(2)}`,
                    } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
                }
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { referralBalance: new Decimal(currentUser.referralBalance ?? 0).minus(totalCost) },
                });
            }

            const premiumUsernameBefore = !!currentUser.premiumUsername?.length;

            // Создаем аккаунт провайдера если нужно
            await this.eventEmitter.emitAsync("proxy.create_account", {
                type: dto.type,
                userId: user.id,
            });

            // Добавляем трафик (createPackageIfNotExists внутри — один UserPackage на тип)
            await this.eventEmitter.emitAsync("user.distribute_traffic", {
                tariff: dto.type,
                traffic: trafficBytes,
                userId: user.id,
                accountJustCreated: dto.type === "RESIDENT_PREMIUM" ? !premiumUsernameBefore : undefined,
            });

            // Реактивируем приостановленные прокси
            this.eventEmitter.emit("proxy.reactivate", {
                userId: user.id,
                proxyType: dto.type,
            });

            // Логируем покупку
            await this.logger.log(
                "REPLENISH",
                `Пользователь ${user.id} приобрёл ${dto.amountGb} ГБ трафика ${dto.type} через API за $${totalCost.toFixed(2)} (источник: ${dto.balanceSource}, ценообразование: ${catalogPackage ? "каталог" : "за ГБ"})`,
                user.id,
                {
                    type: dto.type,
                    amountGb: dto.amountGb,
                    totalCost,
                    trafficBytes,
                    balanceSource: dto.balanceSource,
                    catalogPackageId: catalogPackage?.id ?? null,
                },
            );

            // Получаем обновлённые данные пользователя
            const updatedUser = await this.prisma.user.findUnique({ where: { id: user.id } });

            const result: ApiSuccessResponse<any> = {
                status: "ok",
                code: "200",
                message: {
                    purchased: {
                        type: dto.type,
                        amountGb: dto.amountGb,
                        cost: totalCost,
                        pricing: catalogPackage ? "catalog_package" : "per_gb",
                        catalogPackageId: catalogPackage?.id ?? null,
                    },
                    debitedFrom: dto.balanceSource,
                    newBalance: Number(updatedUser?.balance || 0).toFixed(2),
                    newReferralBalance: Number(updatedUser?.referralBalance || 0).toFixed(2),
                    trafficLeft: {
                        premiumGb: Number(BigInt(updatedUser?.premiumTrafficLeft || "0") / (1024n ** 3n)),
                        mobileGbGb: Number(BigInt((updatedUser as any)?.mobileGbTrafficLeft || "0") / (1024n ** 3n)),
                        ipv6GbGb: Number(BigInt((updatedUser as any)?.ipv6GbTrafficLeft || "0") / (1024n ** 3n)),
                    },
                },
            };
            await this.logApiCall(req, "POST /api/user-api/purchase-traffic", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            await this.logApiCall(req, "POST /api/user-api/purchase-traffic", status, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }

    @Post("purchase-mobile-time")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async purchaseMobileTime(@Body() dto: PurchaseMobileTimeDto, @Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<any>> {
        const startTime = Date.now();
        try {
            // Проверяем что план существует
            const plan = this.proxyService.availableMobileProxyPlans.find((el) => el.id === dto.planId);
            if (!plan) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.INVALID_PACKAGE_TYPE,
                    message: "Неизвестный план мобильных прокси",
                } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
            }

            // Получаем тарификацию по времени
            const mobileTariffications = await this.settingsService.getValue<{
                options: { rentTime: number; price: number }[];
            }>("mobile_tariffications");

            const rentOption = mobileTariffications?.options?.find((el) => el.rentTime === dto.rentTime);
            if (!rentOption) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.INVALID_ROTATION_INTERVAL,
                    message: `Неверное время аренды. Доступные варианты (секунды): ${mobileTariffications?.options?.map(o => o.rentTime).join(", ")}`,
                } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
            }

            const totalCost = rentOption.price;

            // Проверяем баланс
            const currentUser = await this.prisma.user.findUnique({ where: { id: user.id } });
            if (!currentUser || Number(currentUser.balance) < totalCost) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.INSUFFICIENT_BALANCE,
                    message: `Недостаточно средств. Требуется: $${totalCost.toFixed(2)}, на балансе: $${Number(currentUser?.balance || 0).toFixed(2)}`,
                } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
            }

            // Списываем деньги с баланса
            const newBalance = new Decimal(currentUser.balance).minus(totalCost);
            await this.prisma.user.update({
                where: { id: user.id },
                data: { balance: newBalance },
            });

            let userPackage: any;

            if (dto.userPackageId) {
                // Пополнение существующего пакета — добавляем время
                userPackage = await this.prisma.userPackage.findUnique({
                    where: { id: dto.userPackageId },
                });

                if (!userPackage || userPackage.userId !== user.id) {
                    throw new HttpException({
                        status: "error",
                        code: ApiErrorCode.PACKAGE_NOT_FOUND,
                        message: "Пакет не найден или не принадлежит вам",
                    } as ApiErrorResponse, HttpStatus.NOT_FOUND);
                }

                if (userPackage.type !== "MOBILE") {
                    throw new HttpException({
                        status: "error",
                        code: ApiErrorCode.INVALID_PACKAGE_TYPE,
                        message: "Пакет не является мобильным (по времени)",
                    } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
                }

                // Добавляем время к существующему rentTime
                const newRentTime = (userPackage.rentTime || 0) + dto.rentTime;
                userPackage = await this.prisma.userPackage.update({
                    where: { id: dto.userPackageId },
                    data: { rentTime: newRentTime },
                });
            } else {
                // Создание нового пакета
                userPackage = await this.prisma.userPackage.create({
                    data: {
                        userId: user.id,
                        type: "MOBILE",
                        rentTime: dto.rentTime,
                        planId: dto.planId,
                    },
                });
            }

            // Реактивируем приостановленные прокси в пакете
            await this.prisma.proxy.updateMany({
                where: {
                    userPackageId: userPackage.id,
                    status: "SUSPENDED",
                },
                data: {
                    status: "ACTIVE",
                },
            });

            // Логируем покупку
            await this.logger.log(
                "REPLENISH",
                `Пользователь ${user.id} приобрёл ${dto.rentTime} секунд времени для мобильного пакета через API за $${totalCost.toFixed(2)}`,
                user.id,
                {
                    planId: dto.planId,
                    rentTime: dto.rentTime,
                    totalCost,
                    userPackageId: userPackage.id,
                },
            );

            // Получаем обновлённые данные
            const updatedUser = await this.prisma.user.findUnique({ where: { id: user.id } });

            // Рассчитываем оставшееся время
            const now = new Date();
            const expirationTime = new Date(userPackage.createdAt.getTime() + userPackage.rentTime * 1000);
            const remainingSeconds = Math.max(0, Math.floor((expirationTime.getTime() - now.getTime()) / 1000));

            const result: ApiSuccessResponse<any> = {
                status: "ok",
                code: "200",
                message: {
                    purchased: {
                        planId: dto.planId,
                        planName: plan.name,
                        rentTimeSeconds: dto.rentTime,
                        cost: totalCost,
                    },
                    package: {
                        id: userPackage.id,
                        type: "MOBILE",
                        totalRentTimeSeconds: userPackage.rentTime,
                        remainingSeconds,
                        expiresAt: expirationTime.toISOString(),
                    },
                    newBalance: Number(updatedUser?.balance || 0).toFixed(2),
                },
            };
            await this.logApiCall(req, "POST /api/user-api/purchase-mobile-time", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            await this.logApiCall(req, "POST /api/user-api/purchase-mobile-time", status, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }

    @Get("countries")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async getCountries(@Query("packageType") packageType: PackageType, @Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<any>> {
        const startTime = Date.now();
        try {
            if (!packageType) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.MISSING_REQUIRED_FIELD,
                    message: "packageType обязателен",
                } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
            }

        let countries: string[] = [];
        let operators: any[] = [];

        if (packageType === "RESIDENT_PREMIUM") {
            countries = this.proxyService.availableLocations.premium;
        } else if (packageType === "MOBILE_GB") {
            countries = this.proxyService.availableLocations.mobileGb;
        } else if (packageType === "MOBILE") {
            // Для мобильных на время возвращаем страны с операторами
            countries = this.proxyService.availableLocations.mobile;
            // Группируем планы по странам
            const plansByCountry = new Map<string, any[]>();
            for (const plan of this.proxyService.availableMobileProxyPlans) {
                const country = plan.countryCode.toLowerCase();
                if (!plansByCountry.has(country)) {
                    plansByCountry.set(country, []);
                }
                plansByCountry.get(country)!.push({
                    id: plan.id,
                    name: plan.name,
                    description: plan.description,
                    availablePorts: plan.availablePorts,
                    tarifications: plan.tarifications,
                });
            }
            operators = Array.from(plansByCountry.entries()).map(([country, plans]) => ({
                country,
                operators: plans,
            }));
        } else if (packageType === "IPV6_GB") {
            countries = this.proxyService.availableLocations.ipv6;
        } else {
            throw new HttpException({
                status: "error",
                code: ApiErrorCode.INVALID_PACKAGE_TYPE,
                message: "Неизвестный тип пакета",
            } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
        }

            const result: ApiSuccessResponse<any> = {
                status: "ok",
                code: "200",
                message: packageType === "MOBILE" ? { countries, operators } : countries,
            };
            await this.logApiCall(req, "GET /api/user-api/countries", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            await this.logApiCall(req, "GET /api/user-api/countries", status, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }

    @Post("packages/:packageId/proxies")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async createProxy(
        @Param("packageId") packageId: string,
        @Body() dto: CreateProxyDto,
        @Customer() user: User,
        @Req() req: Request,
    ): Promise<ApiSuccessResponse<any>> {
        const startTime = Date.now();
        try {
            // Проверяем что пакет принадлежит пользователю
            const userPackage = await this.prisma.userPackage.findUnique({
                where: { id: packageId },
            });

            if (!userPackage) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.PACKAGE_NOT_FOUND,
                    message: "Пакет не найден",
                } as ApiErrorResponse, HttpStatus.NOT_FOUND);
            }

            if (userPackage.userId !== user.id) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.PACKAGE_NOT_OWNED,
                    message: "Пакет не принадлежит этому пользователю",
                } as ApiErrorResponse, HttpStatus.FORBIDDEN);
            }

            // Проверяем доступность страны для типа пакета
            const packageType = (userPackage as any).type;
            let availableCountries: string[] = [];

            if (packageType === "RESIDENT_PREMIUM") {
                availableCountries = this.proxyService.availableLocations.premium;
            } else if (packageType === "MOBILE_GB") {
                availableCountries = this.proxyService.availableLocations.mobileGb;
            } else if (packageType === "MOBILE") {
                availableCountries = this.proxyService.availableLocations.mobile;
            } else if (packageType === "IPV6_GB") {
                availableCountries = this.proxyService.availableLocations.ipv6;
            }

            const locNorm = dto.location.trim().toLowerCase();
            const allowedSet = new Set(availableCountries.map((c) => c.toLowerCase()));
            if (!allowedSet.has(locNorm)) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.INVALID_COUNTRY,
                    message: `Страна ${dto.location} недоступна для типа пакета ${packageType}`,
                } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
            }

            // Для BY_TIME проверяем rotationInterval
            if (dto.rotation === "BY_TIME") {
                if (!dto.rotationInterval) {
                    throw new HttpException({
                        status: "error",
                        code: ApiErrorCode.MISSING_REQUIRED_FIELD,
                        message: "rotationInterval обязателен для ротации по времени",
                    } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
                }
                if (dto.rotationInterval < 5 || dto.rotationInterval > 120) {
                    throw new HttpException({
                        status: "error",
                        code: ApiErrorCode.INVALID_ROTATION_INTERVAL,
                        message: "rotationInterval должен быть от 5 до 120 минут",
                    } as ApiErrorResponse, HttpStatus.BAD_REQUEST);
                }
            }

            // Используем существующий метод generatePackageProxy
            const generateDto = {
                location: dto.location,
                quantity: dto.quantity,
                rotation: dto.rotation,
                rotationInterval: dto.rotationInterval,
            };

            const result = await this.packageService.generatePackageProxy(packageId, generateDto as any, user.id);

            const response: ApiSuccessResponse<any> = {
                status: "ok",
                code: "200",
                message: result,
            };
            await this.logApiCall(req, `POST /api/user-api/packages/${packageId}/proxies`, HttpStatus.OK, Date.now() - startTime, user.id);
            return response;
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            await this.logApiCall(req, `POST /api/user-api/packages/${packageId}/proxies`, status, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }

    @Get("traffic")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async getTraffic(
        @Query("packageId") packageId: string | undefined,
        @Query("week") week: number | undefined,
        @Customer() user: User,
        @Req() req: Request,
    ): Promise<ApiSuccessResponse<any>> {
        const startTime = Date.now();
        try {
            if (!user) {
                throw new HttpException({
                    status: "error",
                    code: ApiErrorCode.INVALID_API_KEY,
                    message: "Пользователь не найден",
                } as ApiErrorResponse, HttpStatus.UNAUTHORIZED);
            }

            if (packageId) {
                // Статистика по пакету за неделю
                const weekNumber = week || Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
                const startOfWeek = new Date(new Date().getFullYear(), 0, 1);
                startOfWeek.setDate(startOfWeek.getDate() + (weekNumber - 1) * 7);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 7);

                const stats = await this.packageService.getTrafficStats(packageId, startOfWeek, endOfWeek, "day");
                const result: ApiSuccessResponse<any> = {
                    status: "ok",
                    code: "200",
                    message: stats,
                };
                await this.logApiCall(req, "GET /api/user-api/traffic", HttpStatus.OK, Date.now() - startTime, user.id);
                return result;
            } else {
                // Статистика по всему аккаунту
                const stats = await this.userService.getUserTraffic(user.id);
                const result: ApiSuccessResponse<any> = {
                    status: "ok",
                    code: "200",
                    message: stats,
                };
                await this.logApiCall(req, "GET /api/user-api/traffic", HttpStatus.OK, Date.now() - startTime, user.id);
                return result;
            }
        } catch (error: any) {
            const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            await this.logApiCall(req, "GET /api/user-api/traffic", status, Date.now() - startTime, user?.id, error.message);
            throw error;
        }
    }

    @Get("error-codes")
    @HttpCode(HttpStatus.OK)
    @CustomerApiKey()
    async getErrorCodes(@Customer() user: User, @Req() req: Request): Promise<ApiSuccessResponse<any>> {
        const startTime = Date.now();
        try {
            const errorCodes = {
            // Аутентификация
            API_KEY_NOT_FOUND: "API ключ не найден в заголовках запроса",
            INVALID_API_KEY: "Недействительный или неверный API ключ",
            
            // Валидация
            INVALID_COUNTRY: "Указанная страна недоступна для данного типа пакета",
            INVALID_PACKAGE_TYPE: "Неизвестный или неверный тип пакета",
            INVALID_ROTATION_TYPE: "Неверный тип ротации (должен быть BY_REQUEST или BY_TIME)",
            INVALID_ROTATION_INTERVAL: "Неверный интервал ротации (должен быть от 5 до 120 минут)",
            MISSING_REQUIRED_FIELD: "Отсутствует обязательное поле в запросе",
            
            // Баланс и трафик
            INSUFFICIENT_BALANCE: "Недостаточно средств на основном балансе (пополнение ГБ через API)",
            INSUFFICIENT_REFERRAL_BALANCE: "Недостаточно средств на реферальном балансе (пополнение ГБ через API)",
            TRAFFIC_LIMIT_REACHED: "Достигнут лимит трафика",
            
            // Пакеты
            PACKAGE_NOT_FOUND: "Пакет с указанным ID не найден",
            PACKAGE_ALREADY_EXISTS: "Пакет этого типа уже существует",
            PACKAGE_NOT_OWNED: "Пакет не принадлежит текущему пользователю",
            
            // Прокси
            PROXY_CREATION_FAILED: "Ошибка при создании прокси на стороне провайдера",
            PROXY_NOT_FOUND: "Прокси с указанным ID не найден",
            
            // Общие ошибки
            INTERNAL_SERVER_ERROR: "Внутренняя ошибка сервера",
            BAD_REQUEST: "Неверный формат запроса",
            NOT_FOUND: "Ресурс не найден",
        };

            const result: ApiSuccessResponse<any> = {
                status: "ok",
                code: "200",
                message: errorCodes,
            };
            await this.logApiCall(req, "GET /api/user-api/error-codes", HttpStatus.OK, Date.now() - startTime, user.id);
            return result;
        } catch (error: any) {
            await this.logApiCall(req, "GET /api/user-api/error-codes", HttpStatus.INTERNAL_SERVER_ERROR, Date.now() - startTime, user.id, error.message);
            throw error;
        }
    }
}

