import { IsNotEmpty } from "class-validator";

export class ConfirmationDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    token: string;
}
