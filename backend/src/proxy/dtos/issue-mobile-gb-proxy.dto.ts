import { IsInt, IsNotEmpty, IsOptional, Max, Min, MinLength, Validate } from "class-validator";
import { IsIso31661Alpha2Constraint } from "./is-iso3166-1_a-2-constraint";
import { IsIn } from "class-validator";

export class IssueMobileGbProxyDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @MinLength(2, {
        message: "validation.MIN_LENGTH".internationalize(),
    })
    @Validate(IsIso31661Alpha2Constraint, {
        message: "validation.UNKNOWN_LOCATION_FORMAT".internationalize(),
    })
    location: string;

    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(1, {
        message: "validation.MIN".internationalize(),
    })
    quantity: number;

    @IsOptional()
    @IsIn(["BY_REQUEST", "BY_TIME"], {
        message: "validation.INVALID_ROTATION_TYPE".internationalize(),
    })
    rotation?: "BY_REQUEST" | "BY_TIME";

    @IsOptional()
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(1, {
        message: "validation.MIN".internationalize(),
    })
    @Max(120, {
        message: "validation.MAX".internationalize(),
    })
    rotationInterval?: number;
}

