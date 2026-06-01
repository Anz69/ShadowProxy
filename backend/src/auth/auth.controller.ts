import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dtos/register.dto";
import type { Request, Response } from "express";
import { LoginDto } from "./dtos/login.dto";
import { Recaptcha } from "@nestlab/google-recaptcha";
import { AuthProviderGuard } from "./guards/provider.guard";
import { ProviderService } from "./provider/provider.service";
import { ConfigService } from "@nestjs/config";
import { RealIp } from "./decorators/real-ip.decorator";
import { createHash, randomBytes } from "crypto";
import { v4 } from "uuid";
import { TelegramAuthDto } from "./dtos/telegram-auth.dto";
import { TelegramService } from "../telegram/telegram.service";
import { Authorization } from "./decorators/auth.decorator";
import { User } from "./decorators/user.decorator";
import type { User as UserEntity } from "@prisma/client";

@Controller("auth")
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly providerService: ProviderService,
        private readonly configService: ConfigService,
        private readonly telegramService: TelegramService,
    ) {}

    @Recaptcha()
    @Post("register")
    @HttpCode(HttpStatus.OK)
    async register(@Body() dto: RegisterDto, @RealIp() ip: string) {
        return this.authService.register(dto, ip);
    }

    @Recaptcha()
    @Post("login")
    @HttpCode(HttpStatus.OK)
    async login(@Req() req: Request, @Body() dto: LoginDto) {
        return this.authService.login(req, dto);
    }

    @Get("/oauth/connect/:provider")
    @UseGuards(AuthProviderGuard)
    @HttpCode(HttpStatus.OK)
    connect(@Param("provider") provider: string, @Query("referrer") referrer: string | undefined, @Req() req: Request, @Res() res: Response) {
        const providerInstance = this.providerService.findByService(provider);
        const codeVerifier = randomBytes(32).toString("base64url");
        const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const state = v4();
        const redirectUrl = providerInstance?.getRedirectUrl();
        const cookiePath = new URL(redirectUrl || "").pathname;
        const secure = this.configService.get<string>("NODE_ENV") === "production";

        res.cookie(`oauth_${provider}_cv`, codeVerifier, {
            httpOnly: true,
            sameSite: "lax",
            secure,
            maxAge: 10 * 60 * 1000,
            path: cookiePath,
        });
        res.cookie(`oauth_${provider}_state`, state, {
            httpOnly: true,
            sameSite: "lax",
            secure,
            maxAge: 10 * 60 * 1000,
            path: cookiePath,
        });
        if (referrer) {
            res.cookie(`oauth_${provider}_referrer`, referrer, {
                httpOnly: true,
                sameSite: "lax",
                secure,
                maxAge: 10 * 60 * 1000,
                path: cookiePath,
            });
        }

        const url = providerInstance?.getAuthUrl(req, codeChallenge, state);
        return res.redirect(url || "");
    }

    @Get("/oauth/callback/:provider")
    @UseGuards(AuthProviderGuard)
    async callback(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Query("code") code: string,
        @Query("state") state: string,
        @Query("error") error: string,
        @Param("provider") provider: string,
    ) {
        const providerInstance = this.providerService.findByService(provider);
        const cookiePath = new URL(providerInstance!.getRedirectUrl()).pathname;

        const cv = this.getCookie(req, `oauth_${provider}_cv`);
        const st = this.getCookie(req, `oauth_${provider}_state`);
        const referrer = this.getCookie(req, `oauth_${provider}_referrer`);
        const isLinkFlow = this.getCookie(req, `oauth_${provider}_link`) === "1";
        const sessionUserId = (req as Request & { session?: { userId?: string } }).session?.userId;

        const clear = () => {
            res.clearCookie(`oauth_${provider}_cv`, { path: cookiePath });
            res.clearCookie(`oauth_${provider}_state`, { path: cookiePath });
            res.clearCookie(`oauth_${provider}_referrer`, { path: cookiePath });
            res.clearCookie(`oauth_${provider}_link`, { path: cookiePath });
        };

        const host = this.configService.getOrThrow<string>("HOST");

        if (error || !code || !state || !cv || state !== st) {
            clear();
            // При отмене во время привязки — возвращаем в дашборд, не на логин.
            if (isLinkFlow) return res.redirect(`${host}/dashboard?link=canceled`);
            return res.redirect(`${host}/auth/login?reason=oauth_canceled`);
        }

        // Привязка к УЖЕ авторизованному пользователю (Часть 2 ТЗ).
        // Google всегда редиректит на этот URL, поэтому различаем режим по cookie.
        if (isLinkFlow && sessionUserId) {
            try {
                await this.authService.linkOAuthFromCode(req, provider, code, cv, sessionUserId);
                clear();
                return res.redirect(`${host}/dashboard?link=ok`);
            } catch (e: unknown) {
                clear();
                const err = e as { response?: { message?: string }; message?: string };
                const reason = err?.response?.message || err?.message || "link_error";
                return res.redirect(`${host}/dashboard?link=${encodeURIComponent(String(reason))}`);
            }
        }

        await this.authService.extractProfileFromCodeWithVerifier(req, provider, code, cv, referrer);
        clear();
        return res.redirect(`${host}/dashboard`);
    }

    @Get("telegram/bot-id")
    @HttpCode(HttpStatus.OK)
    async getTelegramBotId() {
        try {
            const botInfo = await this.telegramService.getBotInfo();
            return { botId: botInfo.id };
        } catch (error: any) {
            return { botId: null, error: error.message };
        }
    }

    @Post("telegram")
    @HttpCode(HttpStatus.OK)
    async loginWithTelegram(@Req() req: Request, @Body() dto: TelegramAuthDto) {
        return this.authService.loginWithTelegram(req, dto);
    }

    // ─── Привязка аккаунтов к авторизованному юзеру (Часть 2 ТЗ) ───

    @Get("/link/:provider")
    @Authorization()
    @UseGuards(AuthProviderGuard)
    async linkConnect(@Param("provider") provider: string, @Req() req: Request, @Res() res: Response) {
        const providerInstance = this.providerService.findByService(provider);
        const codeVerifier = randomBytes(32).toString("base64url");
        const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const state = v4();
        const redirectUrl = providerInstance?.getRedirectUrl();
        const cookiePath = new URL(redirectUrl || "").pathname;
        const secure = this.configService.get<string>("NODE_ENV") === "production";

        const opts = { httpOnly: true, sameSite: "lax" as const, secure, maxAge: 10 * 60 * 1000, path: cookiePath };
        res.cookie(`oauth_${provider}_cv`, codeVerifier, opts);
        res.cookie(`oauth_${provider}_state`, state, opts);
        res.cookie(`oauth_${provider}_link`, "1", opts);

        const url = providerInstance?.getAuthUrl(req, codeChallenge, state);
        return res.redirect(url || "");
    }

    @Get("/link/:provider/callback")
    @Authorization()
    @UseGuards(AuthProviderGuard)
    async linkCallback(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Query("code") code: string,
        @Query("state") state: string,
        @Query("error") error: string,
        @Param("provider") provider: string,
        @User("id") userId: string,
    ) {
        const providerInstance = this.providerService.findByService(provider);
        const cookiePath = new URL(providerInstance!.getRedirectUrl()).pathname;
        const cv = this.getCookie(req, `oauth_${provider}_cv`);
        const st = this.getCookie(req, `oauth_${provider}_state`);
        const clear = () => {
            res.clearCookie(`oauth_${provider}_cv`, { path: cookiePath });
            res.clearCookie(`oauth_${provider}_state`, { path: cookiePath });
            res.clearCookie(`oauth_${provider}_link`, { path: cookiePath });
        };
        const host = this.configService.getOrThrow<string>("HOST");
        if (error || !code || !state || !cv || state !== st) {
            clear();
            return res.redirect(`${host}/dashboard?link=canceled`);
        }
        try {
            await this.authService.linkOAuthFromCode(req, provider, code, cv, userId);
            clear();
            return res.redirect(`${host}/dashboard?link=ok`);
        } catch (e: any) {
            clear();
            const reason = e?.response?.message || e?.message || "error";
            return res.redirect(`${host}/dashboard?link=${encodeURIComponent(String(reason))}`);
        }
    }

    @Post("/link/telegram")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async linkTelegram(@Body() dto: TelegramAuthDto, @User("id") userId: string) {
        return this.authService.linkTelegram(dto, userId);
    }

    @Delete("/link/:provider")
    @Authorization()
    @HttpCode(HttpStatus.OK)
    async unlink(@Param("provider") provider: string, @User() user: UserEntity) {
        return this.authService.unlinkProvider(user, provider);
    }

    @Post("logout")
    @HttpCode(HttpStatus.OK)
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        return this.authService.logout(req, res);
    }

    private getCookie(req: Request, name: string): string | undefined {
        const cookies = (req as Request & { cookies?: Record<string, unknown> }).cookies;
        const v = cookies?.[name];
        return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
    }
}
