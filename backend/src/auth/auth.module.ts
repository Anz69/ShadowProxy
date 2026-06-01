import { forwardRef, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UserService } from "../user/user.service";
import { GoogleRecaptchaModule, GoogleRecaptchaModuleOptions } from "@nestlab/google-recaptcha";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { isDev } from "../shared/utils/is-dev";
import { ProviderModule } from "./provider/provider.module";
import { OptionsType } from "./provider/provider.constants";
import { GoogleProvider } from "./provider/services/google.provider";
import { AccountService } from "../account/account.service";
import { ProviderService } from "./provider/provider.service";
import { EmailConfirmationModule } from "./email-confirmation/email-confirmation.module";
import { MailingService } from "../mailing/mailing.service";
import { TokenModule } from "../token/token.module";
import { UserModule } from "../user/user.module";
import { AccountModule } from "../account/account.module";
import { LoggerModule } from "../logger/logger.module";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
    imports: [
        ProviderModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService): Promise<OptionsType> => ({
                baseUrl: configService.getOrThrow<string>("HOST"),
                services: [
                    new GoogleProvider({
                        client_id: configService.getOrThrow<string>("GOOGLE_CLIENT_ID"),
                        client_secret: configService.getOrThrow<string>("GOOGLE_CLIENT_SECRET"),
                        scopes: ["email", "profile"],
                    }),
                ],
            }),
            inject: [ConfigService],
        }),
        GoogleRecaptchaModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService): Promise<GoogleRecaptchaModuleOptions> => ({
                secretKey: configService.getOrThrow<string>("RECAPTCHA_SECRET_KEY"),
                response: (req) => req.headers.recaptcha,
                skipIf: isDev(configService),
            }),
            inject: [ConfigService],
        }),
        TokenModule,
        forwardRef(() => UserModule),
        AccountModule,
        LoggerModule,
        TelegramModule,
        forwardRef(() => EmailConfirmationModule),
    ],
    controllers: [AuthController],
    providers: [AuthService, AccountService, MailingService],
    exports: [AuthService],
})
export class AuthModule {}
