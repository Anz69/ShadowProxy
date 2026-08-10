import { IsNumber, IsString, IsOptional, IsObject } from "class-validator";

export class TelegramAuthDto {
    @IsNumber()
    id: number;

    @IsString()
    first_name: string;

    @IsOptional()
    @IsString()
    last_name?: string;

    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @IsString()
    photo_url?: string;

    @IsNumber()
    auth_date: number;

    @IsString()
    hash: string;

    @IsOptional()
    @IsString()
    referrerId?: string;
}

