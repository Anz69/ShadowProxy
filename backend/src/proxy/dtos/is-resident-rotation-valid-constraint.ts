import {
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "IsResidentRotationValidConstraint", async: false })
export class IsResidentRotationValidConstraint implements ValidatorConstraintInterface {
    public validate(value: string, args: ValidationArguments) {
        return ["auto", "by_request", "by_time"].includes(value.toLowerCase());
    }

    public defaultMessage(validationArguments?: ValidationArguments) {
        return "Неизвестный тип ротации!";
    }
}
