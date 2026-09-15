import { Transform } from "class-transformer";
import { IsString, Length, Matches } from "class-validator";

export class ActivatePromoDto {
    @Transform(({ value }) => String(value ?? "").trim().toUpperCase())
    @IsString()
    @Length(3, 64)
    @Matches(/^[A-Z0-9_-]+$/)
    code: string;
}
