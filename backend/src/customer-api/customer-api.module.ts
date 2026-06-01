import { Module } from "@nestjs/common";
import { CustomerApiController } from "./customer-api.controller";
import { UserModule } from "../user/user.module";
import { PackageModule } from "../package/package.module";
import { ProxyModule } from "../proxy/proxy.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
    imports: [UserModule, PackageModule, ProxyModule, SettingsModule],
    controllers: [CustomerApiController],
})
export class CustomerApiModule {}

