import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { AdminPromoController, PromoController } from "./promo.controller";
import { PromoService } from "./promo.service";

@Module({
    // @Authorization() создаёт AuthGuard в контексте PromoModule, поэтому
    // UserService должен быть доступен здесь напрямую, а не только внутри AuthModule.
    imports: [AuthModule, UserModule],
    controllers: [PromoController, AdminPromoController],
    providers: [PromoService],
    exports: [PromoService],
})
export class PromoModule {}
