import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

@ValidatorConstraint({ name: "IsTariffExistsConstraint", async: false })
export class IsTariffExistsConstraint implements ValidatorConstraintInterface {
    public validate(value: string, args: ValidationArguments) {
        const validTariffs = ["resident_premium", "mobile_gb", "ipv6_gb", "premium_residential", "mobile"];
        return validTariffs.includes(value.toLowerCase());
    }

    public defaultMessage(validationArguments?: ValidationArguments) {
        return "Такого типа прокси не существует!";
    }
}
