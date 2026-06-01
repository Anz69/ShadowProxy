import { IsNumber, Min } from "class-validator";

export class ModifyUserBalanceDto {
    @IsNumber(
        {},
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0, {
        message: "validation.MIN".internationalize(),
    })
    balance: number;
}
