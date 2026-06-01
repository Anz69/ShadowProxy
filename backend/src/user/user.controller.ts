import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { UserService } from "./user.service";
import { User } from "../auth/decorators/user.decorator";
import { Authorization } from "../auth/decorators/auth.decorator";
import { User as UserType, UserRole } from "@prisma/client";
import { ModifyUserTrafficDto } from "./dtos/modify-user-traffic.dto";
import { ModifyUserBalanceDto } from "./dtos/modify-user-balance.dto";
import { GetTrialDto } from "./dtos/get-trial.dto";

@Controller("users")
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get("me")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getMe(@User("id") userId: string) {
        return this.userService.findById(userId, true, true);
    }

    @Get("stats")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async getUserStats(@User("id") userId: string) {
        return this.userService.getUserTraffic(userId);
    }

    @Get("all")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async getAllUsers() {
        const users = await this.userService.findMany({
            omit: {
                password: true,
            },
            include: {
                payments: true,
                proxies: true,
            },
        });
        const res: (UserType & { stats: Record<string, string> })[] = [];
        for (const user of users) {
            res.push({
                ...user,
                stats: await this.userService.getUserTraffic(user.id),
            });
        }
        return res;
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
