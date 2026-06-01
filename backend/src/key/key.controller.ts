import { Controller, Delete, HttpCode, HttpStatus, Post, Param, Get, Body } from "@nestjs/common";
import { KeyService } from "./key.service";
import { Authorization } from "../auth/decorators/auth.decorator";
import { UserRole } from "@prisma/client";
import { CreateKeyDto } from "./dtos/create-key.dto";
import { RedeemKeyDto } from "./dtos/redeem-key.dto";
import { User } from "../auth/decorators/user.decorator";
import { DeleteKeysDto } from "./dtos/delete-keys.dto";

@Controller("key")
export class KeyController {
    constructor(private readonly keyService: KeyService) {}

    @Post("/create")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async createKey(@Body() dto: CreateKeyDto) {
        return this.keyService.createKey(dto);
    }

    @Post("/delete")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async deleteKeys(@Body() dto: DeleteKeysDto) {
        return this.keyService.deleteKeys(dto);
    }

    @Get("/all")
    @HttpCode(HttpStatus.OK)
    @Authorization(UserRole.ADMIN)
    async getAllKeys() {
        return this.keyService.findAll();
    }

    @Post("/redeem")
    @HttpCode(HttpStatus.OK)
    @Authorization()
    async redeemKey(@Body() dto: RedeemKeyDto, @User("id") userId: string) {
        return this.keyService.redeemKey(dto, userId);
    }
}
