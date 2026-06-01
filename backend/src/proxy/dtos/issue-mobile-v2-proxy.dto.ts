import { IsInt, IsOptional, IsString, Min, Max, MaxLength } from "class-validator";

export class IssueMobileV2ProxyDto {
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

    @IsInt()
    @Min(1)
    @Max(100)
    quantity: number;
}
