import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { RentedIpService } from "./rented-ip.service";
import { RentIpDto } from "./dtos/rent-ip.dto";
import { Authorization } from "../auth/decorators/auth.decorator";
import { User } from "../auth/decorators/user.decorator";

@Controller("rented-ip")
export class RentedIpController {
    constructor(private readonly rentedIpService: RentedIpService) {}

    @Get()
    @Authorization()
    @HttpCode(HttpStatus.OK)
    list(@User("id") userId: string, @Query("all") all?: string) {
        return this.rentedIpService.listForUser(userId, all === "true");
    }

    @Post("/rent")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    rent(@Body() dto: RentIpDto, @User("id") userId: string) {
        return this.rentedIpService.rent(userId, dto);
    }

    @Get("/export")
    @Authorization()
    async exportTxt(@User("id") userId: string, @Res() res: Response) {
        const text = await this.rentedIpService.exportText(userId);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="rented-ips.txt"');
        res.send(text);
    }

    @Patch("/:id/replace")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    replace(@Param("id") id: string, @User("id") userId: string) {
        return this.rentedIpService.replace(userId, id);
    }

    @Patch("/:id/auto-renew")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    setAutoRenew(@Param("id") id: string, @Body() body: { autoRenew: boolean }, @User("id") userId: string) {
        return this.rentedIpService.setAutoRenew(userId, id, !!body.autoRenew);
    }
}
