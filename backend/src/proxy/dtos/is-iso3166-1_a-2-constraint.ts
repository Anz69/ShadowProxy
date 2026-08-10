import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { ISO31661_ALPHA2 } from "../../shared/constants/regions";

@ValidatorConstraint({ async: false })
export class IsIso31661Alpha2Constraint implements ValidatorConstraintInterface {
    validate(value: string): boolean {
        if (typeof value !== "string") return false;
        return ISO31661_ALPHA2.has(value.toUpperCase());
    }

    defaultMessage(): string {
        return "Некорректный тип локации";
    }
}
