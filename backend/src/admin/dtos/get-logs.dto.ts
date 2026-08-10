import { IsEnum, IsOptional, IsString } from "class-validator";
import { LogType } from "@prisma/client";

export class GetLogsDto {
    @IsOptional()
    @IsEnum(LogType)
    type?: LogType;

    @IsOptional()
    @IsString()
    userId?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    startDate?: string;

    @IsOptional()
    @IsString()
    endDate?: string;

    @IsOptional()
    page?: string;

    @IsOptional()
    limit?: string;
}

