import { Body, Controller, Get, Post, Param, Patch } from "@nestjs/common";
import { SubService } from "./sub.service";
import { ApiKey } from "./decorators/api-key.decorator";
import { CreateAccountDto } from "./dtos/create-account.dto";
import { DistributeTrafficDto } from "./dtos/distribute-traffic.dto";
import { IssueSubIspProxyDto } from "./dtos/issue-sub-isp-proxy.dto";
import { RedeemSubKeyDto } from "./dtos/activate-sub-key.dto";

@Controller("sub")
export class SubController {
    constructor(private readonly subService: SubService) {}

    @Post("/create")
    @ApiKey()
    async createAccount(@Body() dto: CreateAccountDto) {
        return this.subService.createAccount(dto);
    }

    @Get("/:username")
    @ApiKey()
    async getAccount(@Param("username") username: string) {
        return this.subService.getAccount(username);
    }

    @Patch("/:username/distribute-traffic")
    @ApiKey()
    async distributeTraffic(@Param("username") username: string, @Body() dto: DistributeTrafficDto) {
        return this.subService.distributeTraffic(username, dto);
    }

    @Post("/issue")
    @ApiKey()
    async issueProxy(@Body() dto: IssueSubIspProxyDto) {
        return this.subService.issueProxy(dto);
    }

    @Post("/activate-key")
    @ApiKey()
    async activateKey(@Body() dto: RedeemSubKeyDto) {
        return this.subService.activateKey(dto);
    }
}
