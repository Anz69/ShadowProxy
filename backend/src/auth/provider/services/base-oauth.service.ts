import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { BaseProviderOptionsType } from "./types/base-provider-options.type";
import { UserInfoType } from "./types/user-info.type";
import axios from "axios";
import * as crypto from "node:crypto";
import { Request } from "express";

type OAuthTokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    scope?: string;
};

type OAuthProfileResponse = {
    sub?: string | number;
    user_id?: string | number;
    id?: string | number;
    email: string;
};

@Injectable()
export class BaseOauthService {
    private BASE_URL: string;

    constructor(private readonly options: BaseProviderOptionsType) {}

    protected extractUserInfo(data: OAuthProfileResponse): Pick<UserInfoType, "id" | "email" | "provider"> {
        const raw = data.id ?? data.sub ?? data.user_id;
        const id = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
        return { id, email: data.email, provider: this.options.name };
    }

    getAuthUrl(req: Request, codeChallenge: string, state: string) {
        const q = new URLSearchParams({
            response_type: "code",
            client_id: this.options.client_id,
            redirect_uri: this.getRedirectUrl(),
            scope: (this.options.scopes ?? []).join(" "),
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true",
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            state,
        });
        return `${this.options.authorize_url}?${q}`;
    }

    async findUserByCode(_req: Request, code: string, codeVerifier: string): Promise<UserInfoType> {
        if (!codeVerifier) throw new BadRequestException("errors.oauth_error");

        const body = new URLSearchParams({
            client_id: this.options.client_id,
            client_secret: this.options.client_secret,
            redirect_uri: this.getRedirectUrl(),
            grant_type: "authorization_code",
            code,
            code_verifier: codeVerifier,
        });

        const tokenRes = await axios.post<OAuthTokenResponse>(this.options.access_url, body, {
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            timeout: 10000,
            validateStatus: (s) => s >= 200 && s < 500,
        });
        if (tokenRes.status !== 200 || !tokenRes.data?.access_token) throw new BadRequestException("errors.oauth_error");

        const userRes = await axios.get<OAuthProfileResponse>(this.options.profile_url, {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
            timeout: 10000,
            validateStatus: (s) => s >= 200 && s < 500,
        });
        if (userRes.status !== 200 || !userRes.data) throw new UnauthorizedException("errors.oauth_error");

        const now = Math.floor(Date.now() / 1000);
        const expiresAt = tokenRes.data.expires_at ?? (tokenRes.data.expires_in ? now + Number(tokenRes.data.expires_in) : undefined);
        const base = this.extractUserInfo(userRes.data);

        return {
            id: base.id,
            email: base.email,
            provider: base.provider,
            access_token: tokenRes.data.access_token,
            refresh_token: tokenRes.data.refresh_token,
            expires_at: expiresAt,
        } as UserInfoType;
    }

    getRedirectUrl() {
        return `${this.BASE_URL}/api/auth/oauth/callback/${this.options.name}`;
    }

    set baseUrl(value: string) {
        this.BASE_URL = value;
    }

    get name() {
        return this.options.name;
    }

    private generateCodeVerifier() {
        return this.base64url(crypto.randomBytes(32));
    }

    private codeChallenge(verifier: string) {
        return this.base64url(crypto.createHash("sha256").update(verifier).digest());
    }

    private base64url(input: Buffer | string) {
        return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
}
