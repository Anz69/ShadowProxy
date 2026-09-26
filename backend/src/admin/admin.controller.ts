import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Param } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { Authorization } from "../auth/decorators/auth.decorator";
import { UserRole } from "@prisma/client";
import { SetSettingDto } from "./dtos/set-setting.dto";
import { User } from "../auth/decorators/user.decorator";
import { ModifyPricesDto } from "./dtos/modify-prices.dto";
import { GetLogsDto } from "./dtos/get-logs.dto";
import { MangoProxyProvider } from "../proxy/providers/services/mango-proxy.provider";
import { CreateBroadcastDto } from "./dtos/create-broadcast.dto";
import type { BroadcastSegment } from "./dtos/create-broadcast.dto";
import { CreateProxyTestDto } from "./dtos/proxy-test.dto";
import { ProxyTestService } from "./proxy-test.service";

@Controller("admin")
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly mangoProxyProvider: MangoProxyProvider,
        private readonly proxyTestService: ProxyTestService,
    ) {}

    @Post("/setting")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async setSetting(@Body() dto: SetSettingDto, @User("id") userId: string) {
        return this.adminService.setSetting(dto, userId);
    }

    @Post("/prices")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async modifyPrices(@Body() dto: ModifyPricesDto, @User("id") userId: string) {
        return this.adminService.modifyPrices(dto, userId);
    }

    @Post("/proxy-empire/sync-quotas")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async syncProxyEmpireQuotas() {
        return this.adminService.syncProxyEmpireQuotas();
    }

    @Get("/stats")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getStats() {
        return this.adminService.getStats();
    }

    @Get("/stats/charts")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getChartsStats() {
        return this.adminService.getChartsStats();
    }

    @Get("logs/:id")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getLogDetail(@Param("id") id: string) {
        return this.adminService.getLogDetail(id);
    }

    @Get("logs")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getLogs(@Query() query: GetLogsDto) {
        return this.adminService.getLogs(query);
    }

    // ──────────────── Массовые рассылки (Часть 5.3) ────────────────

    @Get("/broadcasts")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async listBroadcasts(@Query("page") page?: string) {
        return this.adminService.listBroadcasts(Number(page) || 1);
    }

    @Get("/broadcasts/audience")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async broadcastAudience(@Query("segment") segment: BroadcastSegment) {
        return this.adminService.broadcastAudienceCount(segment);
    }

    @Post("/broadcasts")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async createBroadcast(@Body() dto: CreateBroadcastDto, @User("id") userId: string) {
        return this.adminService.createBroadcast(dto, userId);
    }

    // ──────────────── Безопасный QA-тестер прокси ────────────────

    @Get("proxy-tests/catalog")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async proxyTestCatalog() {
        return this.proxyTestService.getCatalog();
    }

    @Post("proxy-tests/runs")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.ACCEPTED)
    async createProxyTest(@Body() dto: CreateProxyTestDto) {
        return this.proxyTestService.createRun(dto);
    }

    @Get("proxy-tests/runs/:id")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getProxyTest(@Param("id") id: string) {
        return this.proxyTestService.getRun(id);
    }
}
