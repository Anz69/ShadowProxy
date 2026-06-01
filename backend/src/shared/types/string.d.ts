import { ValidationArguments } from "class-validator";

declare global {
    interface String {
        internationalize(): (a: ValidationArguments) => string;
    }
}

export {};
