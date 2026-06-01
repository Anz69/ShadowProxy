import { IsInt, IsNotEmpty, IsOptional, Validate, Min, Max, IsArray, ArrayNotEmpty, IsString } from "class-validator";
import { IsIso31661Alpha2Constraint } from "./is-iso3166-1_a-2-constraint";
import { IsResidentRotationValidConstraint } from "./is-resident-rotation-valid-constraint";

export class ModifyProxiesDto {
    @IsArray()
    @ArrayNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsString({ each: true, message: "validation.NOT_STRING".internationalize() })
    proxies: string[];

    @IsOptional()
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsIso31661Alpha2Constraint, {
        message: "validation.UNKNOWN_LOCATION_FORMAT".internationalize(),
    })
    location: string;

    @IsOptional()
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsResidentRotationValidConstraint, {
        message: "validation.UNKNOWN_PROXY_ROTATION".internationalize(),
    })
    rotation: "AUTO" | "BY_TIME";

    @IsOptional()
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(5, {
        message: "validation.MIN".internationalize(),
    })
    @Max(90, {
        message: "validation.MAX".internationalize(),
    })
    rotationInterval?: number;
}
