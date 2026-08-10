import { Module } from "@nestjs/common";
import { MailingService } from "./mailing.service";
import { MailerModule, MailerOptions } from "@nestjs-modules/mailer";
import { ConfigModule, ConfigService } from "@nestjs/config";

/**
 * ENV: MAILING_HOST, MAILING_PORT, MAILING_LOGIN, MAILING_PASSWORD
 * Отправитель (from) = полный MAILING_LOGIN
 * Порт 465 требует secure: true (implicit SSL), иначе — соединение падает.
 * Yandex требует полный email для auth (официальная документация).
 */
@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService): Promise<MailerOptions> => {
                const host = configService.getOrThrow<string>("MAILING_HOST");
                const port = Number(configService.getOrThrow<string>("MAILING_PORT"));
                const login = configService.getOrThrow<string>("MAILING_LOGIN");
                // Порт 465 = implicit SSL, обязательно secure: true
                const secure = port === 465;

                return {
                    transport: {
                        host,
                        port,
                        secure,
                        auth: {
                            user: login,
                            pass: configService.getOrThrow<string>("MAILING_PASSWORD"),
                        },
                        connectionTimeout: 60000,
                        greetingTimeout: 30000,
                    },
                    defaults: {
                        from: `"ShadowProxy" <${login}>`,
                    },
                };
            },
            inject: [ConfigService],
        }),
    ],
    providers: [MailingService],
})
export class MailingModule {}
