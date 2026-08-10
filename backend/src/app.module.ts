import { Module } from "@nestjs/common";
import { UserModule } from "./user/user.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from "nestjs-i18n";
import { PrismaModule } from "./prisma/prisma.module";
import { ProvisioningModule } from "./provisioning/provisioning.module";
import { ProviderModule } from "./auth/provider/provider.module";
import { AccountModule } from "./account/account.module";
import { MailingModule } from "./mailing/mailing.module";
import { TokenModule } from "./token/token.module";
import { ResetPasswordModule } from "./auth/reset-password/reset-password.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProxyModule } from "./proxy/proxy.module";
import { SettingsModule } from "./settings/settings.module";
import { AdminModule } from "./admin/admin.module";
import { PackageModule } from "./package/package.module";
import * as path from "node:path";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "./logger/logger.module";
import { KeyModule } from "./key/key.module";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { NodeModule } from './node/node.module';
import { SubService } from './sub/sub.service';
import { SubModule } from './sub/sub.module';
import { TelegramModule } from "./telegram/telegram.module";
import { CustomerApiModule } from "./customer-api/customer-api.module";
import { ProxyServerModule } from "./proxy-server/proxy-server.module";
import { ProxyNodeModule } from "./proxy-node/proxy-node.module";
import { HealthModule } from "./health/health.module";
import { NotificationModule } from "./notification/notification.module";
import { ReviewModule } from "./review/review.module";
import { RentedIpModule } from "./rented-ip/rented-ip.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        I18nModule.forRoot({
            fallbackLanguage: "ru",
            // Без этой карты Accept-Language вида "ru-RU"/"en-US" не находит
            // папку перевода (есть только "ru") и i18n возвращает сырой ключ
            // (напр. "errors.user_not_found"). Маппим всё на "ru".
            fallbacks: {
                "ru-*": "ru",
                "en-*": "ru",
                "zh-*": "ru",
                "*": "ru",
            },
            loaderOptions: {
                path: path.join(__dirname, "/i18n/"),
                watch: true,
            },
            resolvers: [
                {
                    use: QueryResolver,
                    options: ["lang"],
                },
                AcceptLanguageResolver,
                new HeaderResolver(["x-lang"]),
            ],
        }),
        ScheduleModule.forRoot(),
        EventEmitterModule.forRoot({
            wildcard: false,
            delimiter: ".",
            newListener: false,
            removeListener: false,
            maxListeners: 10,
            verboseMemoryLeak: false,
            ignoreErrors: false,
        }),
        UserModule,
        AuthModule,
        PrismaModule,
        ProvisioningModule,
        ProviderModule,
        AccountModule,
        MailingModule,
        TokenModule,
        ResetPasswordModule,
        PaymentsModule,
        ProxyModule,
        SettingsModule,
        AdminModule,
        PackageModule,
        LoggerModule,
        KeyModule,
        NodeModule,
        SubModule,
        TelegramModule,
        CustomerApiModule,
        ProxyServerModule,
        ProxyNodeModule,
        HealthModule,
        NotificationModule,
        ReviewModule,
        RentedIpModule,
    ],
    providers: [SubService],
})
export class AppModule {}
