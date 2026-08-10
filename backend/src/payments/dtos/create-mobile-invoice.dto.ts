import { IsInt, IsNotEmpty, IsNumber, Min, Validate } from "class-validator";
import { IsAssetExistsConstraint } from "./is-asset-exists-constraint";
import type { AvailableAssets } from "../types/available-assets.type";
import { IsMerchantExistsConstraint } from "./is-merchant-exists-constraint";
import { PaymentProvider } from "@prisma/client";

export class CreateMobileInvoiceDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    planId: string;

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

    @IsNumber(
        {},
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(300, {
        message: "validation.MIN".internationalize(),
    })
    rentTime: number;

    userPackageId?: string; // ID существующего UserPackage для пополнения времени
}
