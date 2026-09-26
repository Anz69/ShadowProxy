import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from "class-validator";
import { ProxyType } from "@prisma/client";

export const ADMIN_PROXY_TEST_TYPES = [
    ProxyType.RESIDENT,
    ProxyType.RESIDENT_PREMIUM,
    ProxyType.MOBILE,
    ProxyType.MOBILE_GB,
    ProxyType.IPV6_GB,
    ProxyType.PREMIUM_RESIDENTIAL,
    ProxyType.ISP_USA,
    ProxyType.ISP_EU,
    ProxyType.RESIDENTIAL_LITE,
] as const;

export type AdminProxyTestType = (typeof ADMIN_PROXY_TEST_TYPES)[number];
export type AdminProxyTestTarget = AdminProxyTestType | "ALL";

export class CreateProxyTestDto {
    @IsOptional()
    @IsIn(["ALL", ...ADMIN_PROXY_TEST_TYPES])
    target: AdminProxyTestTarget = "ALL";

    @IsOptional()
    @IsString()
    @Matches(/^[a-z]{2}$/i, { message: "Гео должно быть ISO-2 кодом" })
    country?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(3)
    samplesPerTariff = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0.25)
    @Max(25)
    sizeMb = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(4)
    concurrency = 2;
}
