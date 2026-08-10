import { IsNotEmpty, MinLength, Validate } from "class-validator";
import { IsPasswordsMatchingConstraint } from "../../dtos/is-passwords-matching-constraint";

export class ResetPasswordDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    token: string;

    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @MinLength(6, {
        message: "validation.MIN_LENGTH".internationalize(),
    })
    password: string;

    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsPasswordsMatchingConstraint, {
        message: "validation.PASSWORDS_DONT_MATCH".internationalize(),
    })
    passwordRepeat: string;
}
