import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminPromoController, PromoController } from "./promo.controller";
import { PromoService } from "./promo.service";

@Module({
    imports: [AuthModule],
    controllers: [PromoController, AdminPromoController],
    providers: [PromoService],
    exports: [PromoService],
})
export class PromoModule {}
