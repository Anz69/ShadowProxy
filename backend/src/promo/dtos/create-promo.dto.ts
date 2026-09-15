import { Transform, Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, Length, Matches } from "class-validator";
import { PromoCodeMode } from "@prisma/client";

export class CreatePromoDto {
    @IsOptional()
    @Transform(({ value }) => String(value ?? "").trim().toUpperCase())
    @IsString()
    @Length(3, 64)
    @Matches(/^[A-Z0-9_-]+$/)
    code?: string;

    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    amount: number;

    @IsDateString()
    expiresAt: string;

    @IsEnum(PromoCodeMode)
    mode: PromoCodeMode;
}
