import { Body, ConflictException, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Post, Query, Param } from "@nestjs/common";
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
import { UserService } from "../user/user.service";
import { CreateSupportAccountDto } from "./dtos/create-support-account.dto";
import { LoggerService } from "../logger/logger.service";

@Controller("admin")
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly mangoProxyProvider: MangoProxyProvider,
        private readonly proxyTestService: ProxyTestService,
        private readonly userService: UserService,
        private readonly logger: LoggerService,
    ) {}

    // ───────── Аккаунты поддержки (роль SUPPORT: админка только с разделом «Поддержка») ─────────

    @Get("/support-accounts")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getSupportAccounts() {
        return this.userService.findMany({
            where: { role: UserRole.SUPPORT },
            select: { id: true, email: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        });
    }

    @Post("/support-accounts")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    async createSupportAccount(@Body() dto: CreateSupportAccountDto, @User("id") adminId: string) {
        const email = dto.email.trim().toLowerCase();
        if (await this.userService.findByEmail(email)) throw new ConflictException("errors.email_already_exists");
        const user = await this.userService.create({
            email,
            password: dto.password,
            authMethod: "CREDENTIALS",
            role: UserRole.SUPPORT,
            emailVerified: true,
            region: "EUROPE",
        });
        await this.logger.log("SYSTEM", `Админ ${adminId} создал аккаунт поддержки ${email}`, adminId);
        return { id: user.id, email: user.email, createdAt: user.createdAt };
    }

    /** Снимает роль поддержки (аккаунт остаётся обычным пользователем, история не теряется). */
    @Delete("/support-accounts/:id")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async revokeSupportAccount(@Param("id") id: string, @User("id") adminId: string) {
        const user = await this.userService.findById(id).catch(() => null);
        if (!user || user.role !== UserRole.SUPPORT) throw new NotFoundException("errors.user_not_found");
        await this.userService.updateById(id, { role: UserRole.USER });
        await this.logger.log("SYSTEM", `Админ ${adminId} снял роль поддержки с ${user.email}`, adminId);
        return { ok: true };
    }

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

    /** Кнопка «Проверить баланс Mango» в админке: read-only запрос к /parent_account_info. */
    @Get("/mango/balance")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getMangoBalance() {
        return this.mangoProxyProvider.getParentAccountInfo();
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

    @Get("proxy-tests/runs/current")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getCurrentProxyTest() {
        return this.proxyTestService.getCurrentRun();
    }

    @Get("proxy-tests/runs/:id")
    @Authorization(UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async getProxyTest(@Param("id") id: string) {
        return this.proxyTestService.getRun(id);
    }
}
