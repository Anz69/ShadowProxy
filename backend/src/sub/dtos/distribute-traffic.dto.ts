import { IsNumber, IsPositive, Min } from "class-validator";

export class DistributeTrafficDto {
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    @Min(0, {
        message: "validation.MIN".internationalize(),
    })
    traffic: number;
}
