import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { isProxyTypeDisabled } from "../../shared/constants/sprint-gating";

@ValidatorConstraint({ name: "IsTariffExistsConstraint", async: false })
export class IsTariffExistsConstraint implements ValidatorConstraintInterface {
    public validate(value: unknown, args: ValidationArguments) {
        const validTariffs = ["resident_premium", "mobile_gb", "ipv6_gb", "premium_residential", "mobile", "isp_usa", "isp_eu", "residential_lite"];
        if (typeof value !== "string") return false;
        if (isProxyTypeDisabled(value.toUpperCase())) return false;
        return validTariffs.includes(value.toLowerCase());
    }

    public defaultMessage(validationArguments?: ValidationArguments) {
        return "Такого типа прокси не существует!";
    }
}
