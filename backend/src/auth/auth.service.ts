import { BadRequestException, ConflictException, forwardRef, HttpException, Inject, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { RegisterDto } from "./dtos/register.dto";
import { UserService } from "../user/user.service";
import { AuthMethod, TokenType, User, UserRegion } from "@prisma/client";
import { Request, Response } from "express";
import { LoginDto } from "./dtos/login.dto";
import { verify } from "argon2";
import { ProviderService } from "./provider/provider.service";
import { AccountService } from "../account/account.service";
import { EmailConfirmationService } from "./email-confirmation/email-confirmation.service";
import { TokenService } from "../token/token.service";
import axios from "axios";
import { LoggerService } from "../logger/logger.service";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac } from "crypto";
import { TelegramAuthDto } from "./dtos/telegram-auth.dto";

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly providerService: ProviderService,
        private readonly accountService: AccountService,
        @Inject(forwardRef(() => EmailConfirmationService))
        private readonly emailConfirmationService: EmailConfirmationService,
        private readonly tokenService: TokenService,
        private readonly configService: ConfigService,
        private readonly logger: LoggerService,
    ) {}

    async register(dto: RegisterDto, ip: string) {
        const isExists = await this.userService.findByEmail(dto.email);

        if (isExists) {
            throw new ConflictException("errors.email_already_exists");
        }

        const { passwordRepeat, referrerId, ...userDto } = dto;
        const region = await this.determineRegion(ip);

        if (referrerId) {
            const referrerExists = await this.userService.findById(referrerId, true, true).catch(() => null);
            if (!referrerExists) {
                await this.logger.log("SYSTEM", `Referrer ${referrerId} not found during registration`);
            }
        }

        const user = await this.userService.create({
            ...userDto,
            authMethod: AuthMethod.CREDENTIALS,
            region,
            referrerId: referrerId || undefined,
        } as any);

        await this.emailConfirmationService.sendVerificationEmail(user);

        await this.logger.log("SYSTEM", `Успешная регистрация пользователя ${user.id}. Отправлено письмо для подтверждения почты.`, user.id);

        return {
            success: true,
        };
    }

    async login(req: Request, dto: LoginDto) {
        const isExists = await this.userService.findByEmail(dto.email, false);

        if (!isExists || isExists.authMethod !== AuthMethod.CREDENTIALS) {
            throw new NotFoundException("errors.user_not_found");
        }

        const { password, ...user } = isExists;

        const isPasswordCorrect = await verify(isExists.password, dto.password);

        if (!isPasswordCorrect) {
            throw new BadRequestException("errors.wrong_credentials");
        }

        if (!isExists.emailVerified) {
            try {
                await this.emailConfirmationService.sendVerificationEmail(isExists);
            } catch (error) {
                // Если письмо уже ушло в последнюю минуту, не маскируем это
                // cooldown-ом: пользователь всё равно должен увидеть понятное
                // сообщение о необходимости открыть ссылку из письма.
                if (!(error instanceof HttpException) || error.getStatus() !== 429) {
                    throw error;
                }
            }

            throw new BadRequestException("errors.email_unverified");
        }

        await this.logger.log("SYSTEM", `Пользователь ${isExists.id} успешно авторизовался, используя email и пароль`, isExists.id);
        await this.logger.logUserAction({
            userId: isExists.id,
            actionType: "LOGIN",
            message: `Пользователь ${isExists.email} выполнил вход в систему`,
        });

        return this.saveSession(req, user);
    }

    async extractProfileFromCodeWithVerifier(req: Request, provider: string, code: string, codeVerifier: string, referrerId?: string) {
        const providerInstance = this.providerService.findByService(provider);
        if (!providerInstance) throw new BadRequestException("errors.oauth_error");
        const profile = await providerInstance.findUserByCode(req, code, codeVerifier);
        const providerKey = String(profile.provider).toUpperCase();
        const providerAccountId = String(profile.id);
        const account = await this.accountService.findFirst({ where: { provider: providerKey, providerAccountId } });
        if (account?.userId) {
            const userFound = await this.userService.findById(account.userId, false);
            if (userFound) {
                await this.ensureAccountTokens(account.id, {
                    accessToken: profile.access_token,
                    refreshToken: profile.refresh_token,
                    expiresAt: profile.expires_at || null,
                });
                return this.saveSession(req, userFound);
            }
        }
        const existingUser = await this.userService.findByEmail(profile.email);
        const user =
            existingUser ??
            (await this.userService.create({
                email: profile.email,
                password: "",
                authMethod: providerKey as any,
                emailVerified: true,
                region: await this.determineRegion((req as any).ip),
                referrerId: referrerId || undefined,
            } as any));
        if (!account) {
            await this.accountService.create({
                type: "oauth",
                provider: providerKey,
                providerAccountId,
                accessToken: profile.access_token,
                refreshToken: profile.refresh_token,
                expiresAt: profile.expires_at || 0,
                user: { connect: { id: user.id } },
            });
        } else {
            await this.ensureAccountTokens(account.id, {
                accessToken: profile.access_token,
                refreshToken: profile.refresh_token,
                expiresAt: profile.expires_at || null,
            });
        }
        await this.logger.log("SYSTEM", `Пользователь ${user.id} успешно авторизовался, используя Google`, user.id);
        return this.saveSession(req, user);
    }

    async loginWithTelegram(req: Request, dto: TelegramAuthDto) {
        const botToken = this.configService.get<string>("TELEGRAM_BOT_TOKEN");
        if (!botToken) {
            throw new BadRequestException("errors.telegram_bot_not_configured");
        }

        const { hash, ...data } = dto;
        
        // Filter out undefined/null values and sort keys
        const filteredData: Record<string, string | number> = {};
        Object.keys(data).forEach((key) => {
            const value = data[key as keyof typeof data];
            if (value !== undefined && value !== null) {
                filteredData[key] = value;
            }
        });
        
        const dataCheckString = Object.keys(filteredData)
            .sort()
            .map((key) => `${key}=${String(filteredData[key])}`)
            .join("\n");

        const secretKey = createHash("sha256").update(botToken).digest();
        const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

        if (calculatedHash !== hash) {
            this.logger.error(`Telegram hash validation failed. Expected: ${calculatedHash}, Got: ${hash}, Data: ${dataCheckString}`);
            throw new BadRequestException("errors.telegram_auth_invalid");
        }

        const authDate = dto.auth_date * 1000;
        const now = Date.now();
        if (now - authDate > 86400000) {
            throw new BadRequestException("errors.telegram_auth_expired");
        }

        const providerKey = "TELEGRAM";
        const providerAccountId = String(dto.id);
        const account = await this.accountService.findFirst({
            where: { provider: providerKey, providerAccountId },
        });

        if (account?.userId) {
            const userFound = await this.userService.findById(account.userId, false);
            if (userFound) {
                await this.logger.log("SYSTEM", `Пользователь ${userFound.id} успешно авторизовался, используя Telegram`, userFound.id);
                return this.saveSession(req, userFound);
            }
        }

        const email = `telegram_${dto.id}@shadowproxy.local`;
        const existingUser = await this.userService.findByEmail(email);
        const user =
            existingUser ??
            (await this.userService.create({
                email,
                password: "",
                authMethod: "TELEGRAM" as AuthMethod,
                emailVerified: true,
                region: await this.determineRegion((req as any).ip),
                tgLogin: dto.username || `${dto.first_name}${dto.last_name ? ` ${dto.last_name}` : ""}`,
                referrerId: dto.referrerId || undefined,
            } as any));

        if (!account) {
            await this.accountService.create({
                type: "oauth",
                provider: providerKey,
                providerAccountId,
                expiresAt: 0,
                user: { connect: { id: user.id } },
            });
        }

        await this.logger.log("SYSTEM", `Пользователь ${user.id} успешно авторизовался, используя Telegram`, user.id);
        return this.saveSession(req, user);
    }

    /**
     * Привязка OAuth-провайдера (Google) к УЖЕ авторизованному юзеру.
     * Не создаёт новый аккаунт и не переключает сессию.
     */
    async linkOAuthFromCode(req: Request, provider: string, code: string, codeVerifier: string, currentUserId: string) {
        const providerInstance = this.providerService.findByService(provider);
        if (!providerInstance) throw new BadRequestException("errors.oauth_error");
        const profile = await providerInstance.findUserByCode(req, code, codeVerifier);
        const providerKey = String(profile.provider).toUpperCase();
        const providerAccountId = String(profile.id);

        const existing = await this.accountService.findFirst({ where: { provider: providerKey, providerAccountId } });
        if (existing && existing.userId && existing.userId !== currentUserId) {
            throw new ConflictException("errors.account_already_linked");
        }
        // запрет второго аккаунта того же провайдера у текущего юзера
        const sameProviderForUser = await this.accountService.findFirst({
            where: { provider: providerKey, userId: currentUserId },
        });
        if (sameProviderForUser && sameProviderForUser.providerAccountId !== providerAccountId) {
            throw new ConflictException("errors.account_already_linked");
        }

        if (!existing) {
            await this.accountService.create({
                type: "oauth",
                provider: providerKey,
                providerAccountId,
                accessToken: profile.access_token,
                refreshToken: profile.refresh_token,
                expiresAt: profile.expires_at || 0,
                user: { connect: { id: currentUserId } },
            });
        } else if (!existing.userId) {
            await this.accountService.update(existing.id, { user: { connect: { id: currentUserId } } });
        }
        await this.logger.log("SYSTEM", `Пользователь ${currentUserId} привязал ${providerKey}`, currentUserId);
        return { ok: true, provider: providerKey };
    }

    /**
     * Привязка Telegram к авторизованному юзеру. Верификация HMAC как в loginWithTelegram.
     */
    async linkTelegram(dto: TelegramAuthDto, currentUserId: string) {
        const botToken = this.configService.get<string>("TELEGRAM_BOT_TOKEN");
        if (!botToken) throw new BadRequestException("errors.telegram_bot_not_configured");

        const { hash, ...data } = dto;
        const filteredData: Record<string, string | number> = {};
        Object.keys(data).forEach((key) => {
            const value = data[key as keyof typeof data];
            if (value !== undefined && value !== null) filteredData[key] = value;
        });
        const dataCheckString = Object.keys(filteredData)
            .sort()
            .map((key) => `${key}=${String(filteredData[key])}`)
            .join("\n");
        const secretKey = createHash("sha256").update(botToken).digest();
        const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
        if (calculatedHash !== hash) {
            throw new BadRequestException("errors.telegram_auth_invalid");
        }
        if (Date.now() - dto.auth_date * 1000 > 86400000) {
            throw new BadRequestException("errors.telegram_auth_expired");
        }

        const providerKey = "TELEGRAM";
        const providerAccountId = String(dto.id);
        const existing = await this.accountService.findFirst({
            where: { provider: providerKey, providerAccountId },
        });
        if (existing && existing.userId && existing.userId !== currentUserId) {
            throw new ConflictException("errors.account_already_linked");
        }
        const sameProviderForUser = await this.accountService.findFirst({
            where: { provider: providerKey, userId: currentUserId },
        });
        if (sameProviderForUser && sameProviderForUser.providerAccountId !== providerAccountId) {
            throw new ConflictException("errors.account_already_linked");
        }

        if (!existing) {
            await this.accountService.create({
                type: "oauth",
                provider: providerKey,
                providerAccountId,
                expiresAt: 0,
                user: { connect: { id: currentUserId } },
            });
        } else if (!existing.userId) {
            await this.accountService.update(existing.id, { user: { connect: { id: currentUserId } } });
        }
        await this.logger.log("SYSTEM", `Пользователь ${currentUserId} привязал TELEGRAM`, currentUserId);
        return { ok: true, provider: providerKey };
    }

    /**
     * Отвязка провайдера. Запрет, если это единственный способ входа
     * (нет пароля и не остаётся другого провайдера).
     */
    async unlinkProvider(currentUser: User, provider: string) {
        const providerKey = provider.toUpperCase();
        const account = await this.accountService.findFirst({
            where: { provider: providerKey, userId: currentUser.id },
        });
        if (!account) throw new NotFoundException("errors.account_not_found");

        // @User() возвращает запись без password (excludePassword:true по умолчанию),
        // поэтому подтягиваем user заново с паролем — иначе hasPassword всегда false
        // и CREDENTIALS-юзер не сможет отвязать единственный провайдер.
        const userWithPassword = await this.userService.findById(currentUser.id, false, false);
        const allAccounts = await this.accountService.findMany({ where: { userId: currentUser.id } });
        const hasPassword =
            !!userWithPassword?.password && userWithPassword.password.length > 0;
        const otherProviders = allAccounts.filter((a) => a.id !== account.id);
        if (!hasPassword && otherProviders.length === 0) {
            throw new BadRequestException("errors.cannot_unlink_last_auth");
        }

        await this.accountService.delete(account.id);
        await this.logger.log("SYSTEM", `Пользователь ${currentUser.id} отвязал ${providerKey}`, currentUser.id);
        return { ok: true, provider: providerKey };
    }

    async logout(req: Request, res: Response) {
        const userId = req.session?.userId;
        return new Promise((resolve, reject) => {
            req.session.destroy(async (err) => {
                if (err) {
                    return reject(new InternalServerErrorException("errors.logout_unexpected_error"));
                }
                res.clearCookie("session");
                if (userId) {
                    await this.logger.logUserAction({
                        userId,
                        actionType: "LOGOUT",
                        message: `Пользователь ${userId} выполнил выход из системы`,
                    });
                }
                resolve({});
            });
        });
    }

    async saveSession(req: Request, user: Omit<User, "password">) {
        return new Promise((resolve, reject) => {
            req.session.userId = user.id;

            req.session.save((err) => {
                if (err) {
                    reject(new InternalServerErrorException("errors.authorization_unexpected_error"));
                }

                const { premiumUsername, residentData, residentTotalUsed, ...safeUser } = user;
                resolve({
                    user: safeUser,
                });
            });
        });
    }

    private async ensureAccountTokens(
        id: string,
        data: {
            accessToken?: string;
            refreshToken?: string;
            expiresAt?: number | null;
        },
    ) {
        if (!data.accessToken && !data.refreshToken && !data.expiresAt) return;
        await this.accountService.update(id, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt ?? undefined,
        });
    }

    private async determineRegion(ip: string): Promise<UserRegion> {
        try {
            const geoIpRes = await axios.get(`http://ip-api.com/json/${ip}?fields=status,continentCode`);

            return continentRegions[geoIpRes.data.continentCode.toLowerCase()] || UserRegion.EUROPE;
        } catch (e) {
            try {
                const geoIpResReserve = await axios.get(`https://ipapi.co/${ip}/json/`);

                return continentRegions[geoIpResReserve.data.continentCode.toLowerCase()] || UserRegion.EUROPE;
            } catch (e) {
                return "EUROPE";
            }
        }
    }
}

const continentRegions = {
    af: UserRegion.EUROPE,
    an: UserRegion.USA,
    as: UserRegion.CIS,
    eu: UserRegion.EUROPE,
    na: UserRegion.USA,
    oc: UserRegion.USA,
    sa: UserRegion.USA,
};
