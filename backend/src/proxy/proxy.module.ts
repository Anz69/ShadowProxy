import { forwardRef, Module } from "@nestjs/common";
import { ProxyService } from "./proxy.service";
import { ProxyController } from "./proxy.controller";
import { ProxyProvidersModule } from "./providers/proxy-providers.module";
import { AuthModule } from "../auth/auth.module";
import { UserModule } from "../user/user.module";
import { SettingsModule } from "../settings/settings.module";
import { NodeModule } from "../node/node.module";

@Module({
    imports: [ProxyProvidersModule, forwardRef(() => AuthModule), forwardRef(() => UserModule), SettingsModule, NodeModule],
    controllers: [ProxyController],
    providers: [ProxyService],
    exports: [ProxyService, ProxyProvidersModule],
})
export class ProxyModule {}
