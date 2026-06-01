import { IsEnum, IsIn, IsInt, IsNotEmpty, Min } from "class-validator";

export class PurchaseTrafficDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsEnum(["RESIDENT_PREMIUM", "MOBILE_GB", "IPV6_GB"], {
        message: "validation.INVALID_PACKAGE_TYPE".internationalize(),
    })
    type: "RESIDENT_PREMIUM" | "MOBILE_GB" | "IPV6_GB";

    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsInt({
        message: "amountGb: укажите целое число гигабайт",
    })
    @Min(1, {
        message: "amountGb: минимум 1 ГБ",
    })
    amountGb: number;

    /** С какого баланса списать USD: основной или реферальный */
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsIn(["BALANCE", "REFERRAL_BALANCE"], {
        message: "balanceSource: укажите BALANCE или REFERRAL_BALANCE",
    })
    balanceSource: "BALANCE" | "REFERRAL_BALANCE";
}
