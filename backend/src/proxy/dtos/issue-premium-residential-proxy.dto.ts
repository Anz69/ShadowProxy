import { IsInt, IsOptional, IsString, Min, Max, MaxLength, IsIn } from "class-validator";

export class IssuePremiumResidentialProxyDto {
    @IsOptional()
    @IsString()
    @MaxLength(10)
    location?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    region?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    city?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    isp?: string;

    @IsOptional()
    @IsIn(["random", "sticky", "custom"])
    ip_rotation_type?: "random" | "sticky" | "custom";

    @IsOptional()
    @IsInt()
    @Min(1)
    session_lifetime?: number;

    @IsInt()
    @Min(1)
    @Max(100)
    quantity: number;
}
