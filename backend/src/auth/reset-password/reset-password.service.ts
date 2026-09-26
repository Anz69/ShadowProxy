import { BadRequestException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { TokenService } from "../../token/token.service";
import { Request } from "express";
import { ResetPasswordDto } from "./dtos/reset-password.dto";
import { TokenType } from "@prisma/client";
import { UserService } from "../../user/user.service";
import { hash } from "argon2";
import { MailingService } from "../../mailing/mailing.service";
import { render } from "@react-email/components";
import { ConfigService } from "@nestjs/config";
import { I18nService } from "nestjs-i18n";
import { PasswordResetTemplate } from "../../mailing/templates/password-reset.template";
import { AuthService } from "../auth.service";
import { LoggerService } from "../../logger/logger.service";
import { isDev } from "../../shared/utils/is-dev";

@Injectable()
export class ResetPasswordService {
    private readonly MAIL_COOLDOWN = 1000 * 60; // 1 min

    constructor(
        private readonly tokenService: TokenService,
        private readonly userService: UserService,
        private readonly mailingService: MailingService,
        private readonly i18nService: I18nService<Record<string, unknown>>,
        private readonly configService: ConfigService,
        private readonly authService: AuthService,
        private readonly logger: LoggerService,
    ) {}

    async sendResetEmail(email: string) {
        const isUserExists = await this.userService.findByEmail(email);

        if (!isUserExists) {
            return {
                success: true,
            };
        }

        const lastToken = await this.tokenService.findFirst({
            where: {
                email: email,
                type: TokenType.PASSWORD_RESET,
            },
            orderBy: { createdAt: "desc" },
        });

        if (lastToken && Date.now() - new Date(lastToken.createdAt).getTime() < this.MAIL_COOLDOWN) {
            throw new HttpException("errors.cooldown_active", 429);
        }
        const token = await this.tokenService.issueToken(email, TokenType.PASSWORD_RESET);

        const template = await render(
            PasswordResetTemplate({
                domain: this.configService.getOrThrow<string>("HOST"),
                token: token.token,
                i18n: this.i18nService,
                isDev: isDev(this.configService),
            }),
        );

        await this.logger.log("SYSTEM", `Пользователь ${isUserExists.id} отправил письмо для сброса пароля`, isUserExists.id);

        const result = await this.mailingService.sendMail(email, this.i18nService.t("mailing.subject.password_reset"), template);
        if (!result?.success) {
            await this.tokenService.deleteById(token.id).catch(() => undefined);
            throw new ServiceUnavailableException("errors.email_sending_error");
        }

        return {
            success: true,
        };
    }

    async resetPassword(req: Request, dto: ResetPasswordDto) {
        const token = await this.tokenService.findFirst({
            where: {
                token: dto.token,
                type: TokenType.PASSWORD_RESET,
            },
        });

        if (!token) {
            throw new NotFoundException("errors.token_not_found");
        }

        const isExpired = new Date(token.expiresIn) < new Date();

        if (isExpired) {
            throw new BadRequestException("errors.token_expired");
        }

        const user = await this.userService.findByEmail(token.email);

        if (!user) {
            throw new NotFoundException("errors.user_not_found");
        }

        await this.logger.log("SYSTEM", `Пользователь ${user.id} успешно сбросил пароль`, user.id);

        await this.userService.updateById(user.id, {
            password: await hash(dto.password),
        });

        await this.tokenService.deleteById(token.id);

        return this.authService.saveSession(req, user);
    }
}
