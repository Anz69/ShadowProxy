import {
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from "class-validator";
import { availableAssetsArray } from "../types/available-assets.type";

@ValidatorConstraint({ name: "IsAssetExistsConstraint", async: false })
export class IsAssetExistsConstraint implements ValidatorConstraintInterface {
    public validate(value: string, args: ValidationArguments) {
        return availableAssetsArray.includes(value.toLowerCase());
    }

    public defaultMessage(validationArguments?: ValidationArguments) {
        return "Неизвестная криптовалюта";
    }
}
