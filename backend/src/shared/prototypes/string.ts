import { i18nValidationMessage } from "nestjs-i18n";
import { ValidationArguments } from "class-validator";

if (!String.prototype.internationalize) {
    String.prototype.internationalize = function (): (a: ValidationArguments) => string {
        return i18nValidationMessage(this);
    };
}
