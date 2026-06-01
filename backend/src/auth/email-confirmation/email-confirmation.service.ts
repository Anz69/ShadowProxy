import { BadRequestException, forwardRef, HttpException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { TokenType, User } from "@prisma/client";
import { Request } from "express";
import { ConfirmationDto } from "./dtos/confirmation.dto";
import { TokenService } from "../../token/token.service";
import { MailingService } from "../../mailing/mailing.service";
import { UserService } from "../../user/user.service";
import { AuthService } from "../auth.service";
import { I18nService } from "nestjs-i18n";
import { ConfigService } from "@nestjs/config";
import { render } from "@react-email/components";
import { ConfirmationTemplate } from "../../mailing/templates/confirmation.template";
import { LoggerService } from "../../logger/logger.service";
import { isDev } from "../../shared/utils/is-dev";

@Injectable()
export class EmailConfirmationService {
    private readonly MAIL_COOLDOWN = 1000 * 60; // 1 min

    constructor(
        private readonly tokenService: TokenService,
        private readonly mailingService: MailingService,
        private readonly userService: UserService,
        @Inject(forwardRef(() => AuthService)) private readonly authService: AuthService,
        private readonly i18nService: I18nService<Record<string, unknown>>,
        private readonly configService: ConfigService,
        private readonly loggerService: LoggerService,
    ) {}

    async sendVerificationEmail(user: User) {
        const lastToken = await this.tokenService.findFirst({
            where: {
                email: user.email,
                type: TokenType.VERIFICATION,
            },
            orderBy: { createdAt: "desc" },
        });

        if (lastToken && Date.now() - new Date(lastToken.createdAt).getTime() < this.MAIL_COOLDOWN) {
            throw new HttpException("errors.cooldown_active", 429);
        }

        const token = await this.tokenService.issueToken(user.email, TokenType.VERIFICATION);

        const template = await render(
            ConfirmationTemplate({
                domain: this.configService.getOrThrow<string>("HOST"),
                token: token.token,
                i18n: this.i18nService,
                isDev: isDev(this.configService),
            }),
        );

        return this.mailingService.sendMail(user.email, this.i18nService.t("mailing.subject.confirmation"), template);
    }

    async verifyEmail(req: Request, dto: ConfirmationDto) {
        const isExists = await this.tokenService.findUnique({
            where: {
                token: dto.token,
                type: TokenType.VERIFICATION,
            },
        });

        if (!isExists) {
            throw new NotFoundException("errors.token_not_found");
        }

        const isExpired = new Date(isExists.expiresIn) < new Date();

        if (isExpired) {
            throw new BadRequestException("errors.token_expired");
        }

        const user = await this.userService.findByEmail(isExists.email);

        if (!user) {
            throw new NotFoundException("errors.user_not_found");
        }

        await this.loggerService.log("SYSTEM", `Пользователь ${user.id} успешно подтвердил почту.`, user.id);

        await this.userService.updateById(user.id, {
            emailVerified: true,
        });

        await this.tokenService.deleteById(isExists.id);

        return this.authService.saveSession(req, user);
    }
}
