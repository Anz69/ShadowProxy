import { IsEmail, IsNotEmpty } from "class-validator";

export class RequestPasswordResetDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsEmail({}, { message: "validation.INVALID_EMAIL".internationalize() })
    email: string;
}
