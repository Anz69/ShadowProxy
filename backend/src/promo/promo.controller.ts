import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Authorization } from "../auth/decorators/auth.decorator";
import { User } from "../auth/decorators/user.decorator";
import { ActivatePromoDto } from "./dtos/activate-promo.dto";
import { CreatePromoDto } from "./dtos/create-promo.dto";
import { PromoService } from "./promo.service";

@Controller("promos")
export class PromoController {
    constructor(private readonly promoService: PromoService) {}

    @Post("activate")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    activate(@Body() dto: ActivatePromoDto, @User("id") userId: string) {
        return this.promoService.activate(dto.code, userId);
    }
}

@Controller("admin/promos")
export class AdminPromoController {
    constructor(private readonly promoService: PromoService) {}

    @Get()
    @Authorization(UserRole.ADMIN)
    list() {
        return this.promoService.list();
    }

    @Post()
    @Authorization(UserRole.ADMIN)
    create(@Body() dto: CreatePromoDto, @User("id") adminId: string) {
        return this.promoService.create(dto, adminId);
    }

    @Patch(":id/deactivate")
    @Authorization(UserRole.ADMIN)
    deactivate(@Param("id") id: string, @User("id") adminId: string) {
        return this.promoService.deactivate(id, adminId);
    }

    @Delete(":id")
    @Authorization(UserRole.ADMIN)
    remove(@Param("id") id: string, @User("id") adminId: string) {
        return this.promoService.remove(id, adminId);
    }
}
