import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { SupportTicketStatus } from "@prisma/client";

export class ListSupportTicketsDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 30;

    @IsOptional()
    @IsIn(["NEW", "IN_PROGRESS", "ANSWERED", "CLOSED"])
    status?: SupportTicketStatus;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    search?: string;
}

export class SetTicketStatusDto {
    @IsEnum(SupportTicketStatus)
    status: SupportTicketStatus;
}
