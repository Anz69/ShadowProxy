import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, Validate } from "class-validator";
import { IsPasswordsMatchingConstraint } from "./is-passwords-matching-constraint";

export class RegisterDto {
    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    @IsEmail({}, { message: "validation.INVALID_EMAIL".internationalize() })
    email: string;

    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    @MinLength(6, {
        message: "validation.MIN_LENGTH".internationalize(),
    })
    password: string;

    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    @MinLength(6, {
        message: "validation.MIN_LENGTH".internationalize(),
    })
    @Validate(IsPasswordsMatchingConstraint, {
        message: "validation.PASSWORDS_DONT_MATCH".internationalize(),
    })
    passwordRepeat: string;

    @IsOptional()
    @IsString()
    referrerId?: string;
}
