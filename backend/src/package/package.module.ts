import { forwardRef, Module } from "@nestjs/common";
import { PackageService } from "./package.service";
import { PackageController } from "./package.controller";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { ProxyServerModule } from "../proxy-server/proxy-server.module";
import { ProxyModule } from "../proxy/proxy.module";
import { ProxyProvidersModule } from "../proxy/providers/proxy-providers.module";

@Module({
    imports: [forwardRef(() => AuthModule), forwardRef(() => UserModule), forwardRef(() => ProxyServerModule), forwardRef(() => ProxyModule), ProxyProvidersModule],
    controllers: [PackageController],
    providers: [PackageService],
    exports: [PackageService],
})
export class PackageModule {}
