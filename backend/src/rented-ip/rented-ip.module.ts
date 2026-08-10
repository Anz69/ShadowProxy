import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RentedIpService } from "./rented-ip.service";
import { RentedIpController } from "./rented-ip.controller";
import { RentedIpProvider } from "./rented-ip.provider";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { SettingsModule } from "../settings/settings.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
    imports: [ConfigModule, AuthModule, forwardRef(() => UserModule), SettingsModule, NotificationModule],
    controllers: [RentedIpController],
    providers: [RentedIpService, RentedIpProvider],
    exports: [RentedIpService],
})
export class RentedIpModule {}
