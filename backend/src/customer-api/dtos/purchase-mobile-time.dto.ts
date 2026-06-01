import { IsInt, IsNotEmpty, IsOptional, Min } from "class-validator";

export class PurchaseMobileTimeDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    planId: string;

    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(300, {
        message: "validation.MIN".internationalize(),
    })
    rentTime: number;

    @IsOptional()
    userPackageId?: string;
}
