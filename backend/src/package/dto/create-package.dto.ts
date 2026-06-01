import { PackageType } from "@prisma/client";
import { IsNotEmpty, IsNumber, IsOptional, Min, Validate } from "class-validator";
import { IsTariffExistsConstraint } from "../../payments/dtos/is-tariff-exists-constraint";

export class CreatePackageDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsTariffExistsConstraint, {
        message: "validation.UNKNOWN_PROXY_TARIFF".internationalize(),
    })
    type: PackageType;

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
    traffic: number;

    // Цена больше не задаётся в пакете (берётся из тарификации). Оставлена
    // опциональной ради колонки в БД и обратной совместимости.
    @IsOptional()
    @IsNumber(
        {
            allowNaN: false,
            allowInfinity: false,
        },
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0, {
        message: "validation.MIN".internationalize(),
    })
    price: number = 0;
}
