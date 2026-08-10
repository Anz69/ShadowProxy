export type UserInfoType = {
    id: string;
    email: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    provider: string;
};
