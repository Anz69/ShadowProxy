import { IsNotEmpty, IsUUID } from "class-validator";

export class RedeemKeyDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsUUID(4, {
        message: "validation.NOT_UUID".internationalize(),
    })
    key: string;
}
