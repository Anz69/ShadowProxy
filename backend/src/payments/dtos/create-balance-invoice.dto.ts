import { IsNumber, IsString, Min, Validate } from "class-validator";
import { PaymentProvider } from "@prisma/client";
import type { AvailableAssets } from "../types/available-assets.type";
import { IsMerchantExistsConstraint } from "./is-merchant-exists-constraint";

export class CreateBalanceInvoiceDto {
    @IsNumber()
    @Min(0.01)
    amount: number;

    @IsString()
    asset: AvailableAssets;

    @IsString()
    @Validate(IsMerchantExistsConstraint, {
        message: "errors.unknown_merchant",
    })
    merchant: PaymentProvider;
}

