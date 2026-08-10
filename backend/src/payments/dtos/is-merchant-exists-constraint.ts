import { ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

@ValidatorConstraint({ name: "IsMerchantExistsConstraint", async: false })
export class IsMerchantExistsConstraint implements ValidatorConstraintInterface {
    public validate(value: string) {
        return ["CRYPTO_BOT", "HELEKET", "BALANCE", "REFERRAL_BALANCE"].includes(value);
    }

    public defaultMessage() {
        return "Неизвестная криптовалюта";
    }
}
