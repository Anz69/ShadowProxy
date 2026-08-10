import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class RedeemSubKeyDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsUUID(4, {
        message: "validation.NOT_UUID".internationalize(),
    })
    key: string;

    @IsString({
        message: "validation.NOT_STRING".internationalize(),
    })
    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    username: string;
}
