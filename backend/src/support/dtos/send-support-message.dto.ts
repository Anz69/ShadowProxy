import { IsOptional, IsString, MaxLength } from "class-validator";

export class SendSupportMessageDto {
    /** Текст сообщения (может быть пустым, если есть вложения). */
    @IsOptional()
    @IsString()
    @MaxLength(5000)
    text?: string;
}
