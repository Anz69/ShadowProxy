import {
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "IsPackageTypeValidConstraint", async: false })
export class IsPackageTypeValidConstraint implements ValidatorConstraintInterface {
    public validate(value: string, args: ValidationArguments) {
        return ["RESIDENT_PREMIUM", "MOBILE", "MOBILE_GB", "ISP", "IPV6_GB"].includes(value);
    }

    public defaultMessage(validationArguments?: ValidationArguments) {
        return "Неизвестный тип прокси!";
    }
}
