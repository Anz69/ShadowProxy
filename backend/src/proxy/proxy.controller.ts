import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ProxyService } from "./proxy.service";
import { Authorization } from "../auth/decorators/auth.decorator";
import { User } from "../auth/decorators/user.decorator";
import { SettingsService } from "../settings/settings.service";
import { IssueIspProxyDto } from "./dtos/issue-isp-proxy.dto";
import { IssueMobileGbProxyDto } from "./dtos/issue-mobile-gb-proxy.dto";
import { IssuePremiumResidentialProxyDto } from "./dtos/issue-premium-residential-proxy.dto";
import { IssueMobileV2ProxyDto } from "./dtos/issue-mobile-v2-proxy.dto";
import { type GetProxiesQueryParams } from "./types/get-paginated-proxies.type";
import { ModifyProxiesDto } from "./dtos/modify-proxies.dto";
import { NodeService } from "../node/node.service";
import { regionToServer } from "../shared/utils/region-to-server";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Controller("proxy")
export class ProxyController {
    constructor(
        private readonly proxyService: ProxyService,
        private readonly settingsService: SettingsService,
        private readonly nodeService: NodeService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {}

    @Post("/issue/isp")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async issueIspProxy(@Body() dto: IssueIspProxyDto, @User("id") userId: string) {
        return this.proxyService.issueIspProxy(dto, userId);
    }

    /**
     * @deprecated Legacy FlashProxy/LTE-Socks Mobile (см. задача 5 ТЗ — заменён ProxyEmpire).
     * Включается env-флагом ENABLE_LEGACY_MOBILE_GB=true для аварийного отката.
     * По умолчанию возвращает 410 Gone, баланс юзеров был мигрирован в mobile_traffic_left.
     */
    @Post("/issue/mobile-gb")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async issueMobileGbProxy(@Body() dto: IssueMobileGbProxyDto, @User("id") userId: string) {
        if (this.configService.get<string>("ENABLE_LEGACY_MOBILE_GB") !== "true") {
            throw new HttpException(
                { message: "errors.legacy_mobile_gb_disabled", redirect: "/api/proxy/issue/mobile" },
                HttpStatus.GONE,
            );
        }
        return this.proxyService.issueMobileGbProxy(dto, userId);
    }

    @Post("/issue/premium-residential")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async issuePremiumResidentialProxy(@Body() dto: IssuePremiumResidentialProxyDto, @User("id") userId: string) {
        return this.proxyService.issuePremiumResidentialProxy(dto, userId);
    }

    @Post("/issue/mobile")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async issueMobileV2Proxy(@Body() dto: IssueMobileV2ProxyDto, @User("id") userId: string) {
        return this.proxyService.issueMobileV2Proxy(dto, userId);
    }

    @Get("/locations")
    @HttpCode(HttpStatus.OK)
    getLocations() {
        return this.proxyService.availableLocations;
    }

    @Get("/empire/regions")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getProxyEmpireRegions(
        @Query("connection_type") connectionType: "residential" | "mobile",
        @Query("country_code") countryCode: string,
    ) {
        return this.proxyService.getProxyEmpireRegions(connectionType ?? "residential", countryCode);
    }

    @Get("/empire/cities")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getProxyEmpireCities(
        @Query("connection_type") connectionType: "residential" | "mobile",
        @Query("country_code") countryCode: string,
        @Query("region") region?: string,
    ) {
        return this.proxyService.getProxyEmpireCities(connectionType ?? "residential", countryCode, region);
    }

    @Get("/empire/isps")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getProxyEmpireIsps(
        @Query("connection_type") connectionType: "residential" | "mobile",
        @Query("country_code") countryCode: string,
        @Query("region") region?: string,
        @Query("city") city?: string,
    ) {
        return this.proxyService.getProxyEmpireIsps(connectionType ?? "residential", countryCode, region, city);
    }

    // Mango Residential Proxy — фильтры state/city/ASN (задача 2 ТЗ).
    // Названия endpoints зеркалят /empire/* для единообразия фронта.
    @Get("/mango/regions")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getMangoRegions(@Query("country_code") countryCode: string) {
        return this.proxyService.getMangoRegions(countryCode);
    }

    @Get("/mango/cities")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getMangoCities(
        @Query("country_code") countryCode: string,
        @Query("region") region?: string,
    ) {
        return this.proxyService.getMangoCities(countryCode, region);
    }

    @Get("/mango/isps")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getMangoIsps(
        @Query("country_code") countryCode: string,
        @Query("region") region?: string,
        @Query("city") city?: string,
    ) {
        return this.proxyService.getMangoIsps(countryCode, region, city);
    }

    @Get("/plans")
    @HttpCode(HttpStatus.OK)
    getPlans() {
        return this.proxyService.availableMobileProxyPlans;
    }

    @Get("/my")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    getMyProxies(@Query() query: GetProxiesQueryParams, @User("id") userId: string) {
        return this.proxyService.getPaginatedProxies(query, userId);
    }

    @Get("/prices")
    @HttpCode(HttpStatus.OK)
    async getPrices() {
        const proxyTariffications = await this.settingsService.getValue<{
            resident_premium: number;
            mobile_gb?: number;
            ipv6_gb?: number;
            premium_residential?: number;
            isp_usa?: number;
            isp_eu?: number;
            residential_lite?: number;
        }>("proxy_tariffications");
        const mobileTariffications = await this.settingsService.getValue<{
            options: { price: number; rentTime: number }[];
        }>("mobile_tariffications");
        const mobileGbPrice = proxyTariffications?.mobile_gb ?? 0.5;
        return {
            resident_premium: proxyTariffications?.resident_premium ?? 1.2,
            premium_residential: proxyTariffications?.premium_residential ?? 1.5,
            mobile_gb: mobileGbPrice,
            ipv6_gb: proxyTariffications?.ipv6_gb ?? 5.0,
            // MOBILE теперь GB-based (через ProxyEmpire). Цена = mobile_gb.
            mobile: mobileGbPrice,
            // Новые типы (считаются на нашей стороне). Дефолты совпадают с getDefaultPrice.
            isp_usa: proxyTariffications?.isp_usa ?? 1.5,
            isp_eu: proxyTariffications?.isp_eu ?? 1.5,
            residential_lite: proxyTariffications?.residential_lite ?? 0.9,
            // Legacy time-based options сохранены для совместимости со старыми клиентами
            mobile_legacy_options: mobileTariffications?.options ?? [],
        };
    }

    @Patch("/modify")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async modifyProxy(@Body() dto: ModifyProxiesDto, @User("id") userId: string) {
        return this.proxyService.modifyProxies(dto, userId);
    }

    @Post("/get-many")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getMany(@Body() dto: { proxyIds: string[] }, @User("id") userId: string) {
        return this.proxyService.findMany({
            where: {
                id: {
                    in: dto.proxyIds,
                },
                userId,
            },
        });
    }

    @Post("/refresh/:proxyId")
    @HttpCode(HttpStatus.OK)
    async refreshProxy(@Param("proxyId") proxyId: string) {
        return this.proxyService.refreshProxy(proxyId);
    }

    @Post("/cleanup")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async cleanupUserProxies(@User("id") userId: string) {
        await this.nodeService.deleteUserProxies(userId);
        return { message: "User proxies cleanup initiated" };
    }

    @Post("/sync-ports")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async syncActivePorts() {
        await this.nodeService.forceSyncAllPorts();
        return { message: "Port synchronization initiated" };
    }

    @Get("/server-ports/:serverHost")
    @HttpCode(HttpStatus.OK)
    async getServerActivePorts(@Param("serverHost") serverHost: string) {
        const activePorts = await this.prisma.proxy.findMany({
            where: {
                serverHost: serverHost,
                lastActivityAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Активные за последние 24 часа
                },
            },
        });

        const ports = activePorts.map(proxy => {
            console.log(`[SERVER PORTS API] Прокси ${proxy.userPort}: userId='${proxy.userId}', login='${proxy.userLogin}', proxy.host='${proxy.host}', proxy.username='${proxy.username}'`);
            return {
                port: proxy.userPort,
                user_id: proxy.userId,
                login: proxy.userLogin,
                password: proxy.userPassword,
                proxy_host: proxy.host,
                proxy_port: proxy.port,
                proxy_username: proxy.username, // Логин для подключения к provider proxy
                proxy_password: proxy.password, // Пароль для подключения к provider proxy
            };
        });

        return {
            server_host: serverHost,
            active_ports: ports,
            total_count: ports.length,
        };
    }
}
