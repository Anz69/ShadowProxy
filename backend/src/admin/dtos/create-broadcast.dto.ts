import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export const BROADCAST_SEGMENTS = ["all", "trial_active", "after_purchase", "no_purchases"] as const;
export type BroadcastSegment = (typeof BROADCAST_SEGMENTS)[number];

export class CreateBroadcastDto {
    @IsString()
    @IsNotEmpty({ message: "Заголовок обязателен" })
    @MaxLength(200)
    title: string;

    @IsString()
    @IsNotEmpty({ message: "Текст обязателен" })
    @MaxLength(2000)
    body: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    link?: string;

    @IsIn(BROADCAST_SEGMENTS, { message: "Неизвестный сегмент аудитории" })
    segment: BroadcastSegment;
}
