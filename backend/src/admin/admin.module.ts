import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { CloudflareAnalyticsService } from "./cloudflare-analytics.service";
import { SettingsModule } from "../settings/settings.module";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { ProxyModule } from "../proxy/proxy.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProxyServerModule } from "../proxy-server/proxy-server.module";
import { ProxyTestService } from "./proxy-test.service";

@Module({
    imports: [SettingsModule, AuthModule, UserModule, ProxyModule, PrismaModule, ProxyServerModule],
    controllers: [AdminController],
    providers: [AdminService, CloudflareAnalyticsService, ProxyTestService],
})
export class AdminModule {}
