import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

@ValidatorConstraint({ name: "IsIpv6LocationValidConstraint", async: false })
export class IsIpv6LocationValidConstraint implements ValidatorConstraintInterface {
    public validate(value: string, args: ValidationArguments) {
        if (!value || typeof value !== "string") {
            return false;
        }
        // IPv6 доступен только для Германии (DE) и Нидерландов (NL)
        const validLocations = ["de", "nl"];
        return validLocations.includes(value.toLowerCase());
    }

    public defaultMessage(validationArguments?: ValidationArguments) {
        return "Для IPv6 доступны только Германия (DE) и Нидерланды (NL)";
    }
}

