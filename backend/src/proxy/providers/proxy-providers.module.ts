import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MangoProxyProvider } from "./services/mango-proxy.provider";
import { UserModule } from "../../user/user.module";
import { LteSocksProvider } from "./services/lte-socks.provider";
import { Proxy922Provider } from "./services/proxy-922.provider";
import { MobileGbProvider } from "./services/mobile-gb.provider";
import { ProxyEmpireProvider } from "./services/proxy-empire.provider";
import { LoggerModule } from "../../logger/logger.module";

@Module({
    imports: [ConfigModule, LoggerModule, forwardRef(() => UserModule)],
    providers: [MangoProxyProvider, LteSocksProvider, Proxy922Provider, MobileGbProvider, ProxyEmpireProvider],
    exports: [MangoProxyProvider, LteSocksProvider, Proxy922Provider, MobileGbProvider, ProxyEmpireProvider],
})
export class ProxyProvidersModule {}
