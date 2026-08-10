import { IsNotEmpty, IsUUID, Validate } from "class-validator";
import { IsTariffExistsConstraint } from "./is-tariff-exists-constraint";
import { type AvailableAssets } from "../types/available-assets.type";
import { IsAssetExistsConstraint } from "./is-asset-exists-constraint";
import { IsMerchantExistsConstraint } from "./is-merchant-exists-constraint";
import { PaymentProvider } from "@prisma/client";

export class CreatePackageInvoiceDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsUUID("4", {
        message: "validation.NOT_UUID".internationalize(),
    })
    package: string;

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
