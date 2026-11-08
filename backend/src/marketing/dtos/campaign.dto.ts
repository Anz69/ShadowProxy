import { Transform, Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, Length, Matches, Max, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateCampaignDto {
    @Transform(trim)
    @IsString()
    @Length(1, 120)
    name: string;

    @Transform(trim)
    @IsString()
    @Length(1, 60)
    source: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(5000)
    note?: string;
}

export class UpdateCampaignDto {
    @IsOptional()
    @Transform(trim)
    @IsString()
    @Length(1, 120)
    name?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @Length(1, 60)
    source?: string;
}

export class AddExpenseDto {
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Max(10_000_000)
    amount: number;

    @IsOptional()
    @IsDateString()
    spentAt?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @MaxLength(500)
    comment?: string;
}

export class AddNoteDto {
    @Transform(trim)
    @IsString()
    @Length(1, 5000)
    text: string;
}

export class CampaignStatsQueryDto {
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    from?: string;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    to?: string;
}
