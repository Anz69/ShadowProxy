import { IsNotEmpty, IsString } from "class-validator";

export class CreateAccountDto {
    @IsString({
        message: "validation.NOT_STRING".internationalize(),
    })
    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    username: string;

    @IsString({
        message: "validation.NOT_STRING".internationalize(),
    })
    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    password: string;
}
