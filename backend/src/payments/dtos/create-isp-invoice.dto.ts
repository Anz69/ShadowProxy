import { IsInt, IsNotEmpty, IsNumber, Min, Validate } from "class-validator";
import { IsTariffExistsConstraint } from "./is-tariff-exists-constraint";
import { type AvailableAssets } from "../types/available-assets.type";
import { IsAssetExistsConstraint } from "./is-asset-exists-constraint";
import { IsMerchantExistsConstraint } from "./is-merchant-exists-constraint";
import { PaymentProvider } from "@prisma/client";

export class CreateIspInvoiceDto {
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

    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsAssetExistsConstraint, {
        message: "validation.UNKNOWN_ASSET".internationalize(),
    })
    asset: AvailableAssets;

    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsMerchantExistsConstraint, {
        message: "validation.UNKNOWN_MERCHANT".internationalize(),
    })
    merchant: PaymentProvider;
}
