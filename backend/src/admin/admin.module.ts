import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { CloudflareAnalyticsService } from "./cloudflare-analytics.service";
import { SettingsModule } from "../settings/settings.module";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { ProxyModule } from "../proxy/proxy.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
    imports: [SettingsModule, AuthModule, UserModule, ProxyModule, PrismaModule],
    controllers: [AdminController],
    providers: [AdminService, CloudflareAnalyticsService],
})
export class AdminModule {}
