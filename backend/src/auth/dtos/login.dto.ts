import { IsEmail, IsNotEmpty, MinLength } from "class-validator";

export class LoginDto {
    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    @IsEmail({}, { message: "validation.INVALID_EMAIL".internationalize() })
    email: string;

    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    @MinLength(6, {
        message: "validation.MIN_LENGTH".internationalize(),
    })
    password: string;
}
