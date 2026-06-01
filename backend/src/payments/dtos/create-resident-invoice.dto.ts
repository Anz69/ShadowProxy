import { IsInt, IsNotEmpty, IsNumber, Min, Validate } from "class-validator";
import { IsTariffExistsConstraint } from "./is-tariff-exists-constraint";
import { type AvailableAssets } from "../types/available-assets.type";
import { IsAssetExistsConstraint } from "./is-asset-exists-constraint";
import { IsMerchantExistsConstraint } from "./is-merchant-exists-constraint";
import { PaymentProvider } from "@prisma/client";

export class CreateResidentInvoiceDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsTariffExistsConstraint, [true], {
        message: "validation.UNKNOWN_PROXY_TARIFF".internationalize(),
    })
    tariff: "RESIDENT_PREMIUM" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL" | "MOBILE";

    @IsNumber(
        {
            allowNaN: false,
            allowInfinity: false,
        },
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0.1, {
        message: "validation.MIN".internationalize(),
    })
    traffic: number;

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
