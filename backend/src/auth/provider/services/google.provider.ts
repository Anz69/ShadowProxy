import { BaseOauthService } from "./base-oauth.service";
import { ProviderOptionsType } from "./types/provider-options.type";
import { UserInfoType } from "./types/user-info.type";

export class GoogleProvider extends BaseOauthService {
    constructor(options: ProviderOptionsType) {
        super({
            name: "google",
            authorize_url: "https://accounts.google.com/o/oauth2/v2/auth",
            access_url: "https://oauth2.googleapis.com/token",
            profile_url: "https://www.googleapis.com/oauth2/v3/userinfo",
            scopes: options.scopes,
            client_id: options.client_id,
            client_secret: options.client_secret,
        });
    }

    extractUserInfo(data: GoogleProfile): UserInfoType {
        return super.extractUserInfo({
            id: data.sub,
            email: data.email,
        });
    }
}

type GoogleProfile = {
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
};
