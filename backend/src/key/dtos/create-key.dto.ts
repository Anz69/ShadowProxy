import { IsInt, IsNotEmpty, IsNumber, Min, Validate } from "class-validator";
import { IsTariffExistsConstraint } from "../../payments/dtos/is-tariff-exists-constraint";
import { PackageType } from "@prisma/client";

export class CreateKeyDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsTariffExistsConstraint, {
        message: "validation.UNKNOWN_PROXY_TARIFF".internationalize(),
    })
    tariff: PackageType;

    @IsNumber(
        {
            allowNaN: false,
            allowInfinity: false,
        },
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0.001, {
        message: "validation.MIN".internationalize(),
    })
    contents: number;

    @IsNumber(
        {
            allowNaN: false,
            allowInfinity: false,
        },
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(1, {
        message: "validation.MIN".internationalize(),
    })
    quantity: number;
}
