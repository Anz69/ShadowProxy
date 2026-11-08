import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { MarketingController } from "./marketing.controller";
import { MarketingService } from "./marketing.service";

@Module({
    // @Authorization() создаёт AuthGuard в контексте модуля — нужен UserService.
    imports: [AuthModule, UserModule],
    controllers: [MarketingController],
    providers: [MarketingService],
})
export class MarketingModule {}
