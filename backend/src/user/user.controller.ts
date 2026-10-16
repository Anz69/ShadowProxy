import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { UserService } from "./user.service";
import { User } from "../auth/decorators/user.decorator";
import { Authorization } from "../auth/decorators/auth.decorator";
import { UserRole } from "@prisma/client";
import { ModifyUserTrafficDto } from "./dtos/modify-user-traffic.dto";
import { ModifyUserBalanceDto } from "./dtos/modify-user-balance.dto";
import { GetTrialDto } from "./dtos/get-trial.dto";
import { GetAdminUsersDto } from "./dtos/get-admin-users.dto";

@Controller("users")
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get("me")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getMe(@User("id") userId: string) {
        const [user, trafficCredited] = await Promise.all([
            this.userService.findById(userId, true, true),
            this.userService.getTrafficCredited(userId),
        ]);
        return { ...user, trafficCredited };
    }

    @Get("stats")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getUserStats(@User("id") userId: string) {
        return this.userService.getUserTraffic(userId);
    }

    /**
     * Админ-список пользователей: пагинация + поиск + сортировка (ТЗ 3.1–3.3).
     * Раньше грузил ВСЕХ юзеров с include payments/proxies и N+1 getUserTraffic —
     * источник лагов админки. Транзакции/статистика юзера — отдельными эндпоинтами.
     */
    @Get("all")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async getAllUsers(@Query() dto: GetAdminUsersDto) {
        return this.userService.findAdminUsers(dto);
    }

    /** Статистика трафика конкретного юзера для админ-модалки (лениво, по клику). */
    @Get(":userId/stats")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async getUserStatsAdmin(@Param("userId") userId: string) {
        return this.userService.getUserTraffic(userId);
    }

    @Patch("/:userId/traffic")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async modifyUserTraffic(@Param("userId") userId: string, @Body() dto: ModifyUserTrafficDto) {
        return this.userService.modifyUserTraffic(dto, userId);
    }

    @Patch("/:userId/balance")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async modifyUserBalance(@Param("userId") userId: string, @Body() dto: ModifyUserBalanceDto) {
        return this.userService.modifyUserBalance(dto, userId);
    }

    @Get("api-key")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getApiKey(@User("id") userId: string) {
        const user = await this.userService.findById(userId, true, true);
        return { apiKey: user.apiKey || null };
    }

    @Post("api-key/generate")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async generateApiKey(@User("id") userId: string) {
        const apiKey = await this.userService.generateApiKey(userId);
        return { apiKey };
    }

    @Get("referrals/count")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getReferralsCount(@User("id") userId: string) {
        const count = await this.userService.getReferralsCount(userId);
        return { count };
    }

    @Get("referrals/rewards")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getReferralRewards(@User("id") userId: string) {
        return this.userService.getReferralRewards(userId);
    }

    @Post("trial")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getTrial(
        @User("id") userId: string,
        @Body() dto: GetTrialDto
    ) {
        return this.userService.getTrial(userId, dto.tariffType);
    }
}
