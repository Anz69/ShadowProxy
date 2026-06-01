import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength, Max, Validate } from "class-validator";
import { IsIso31661Alpha2Constraint } from "../../proxy/dtos/is-iso3166-1_a-2-constraint";

export enum ProxyRotation {
    BY_REQUEST = "BY_REQUEST",
    BY_TIME = "BY_TIME",
}

export class CreateProxyDto {
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

    @IsOptional()
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(1, {
        message: "validation.MIN".internationalize(),
    })
    quantity?: number;

    @IsOptional()
    @IsEnum(ProxyRotation, {
        message: "validation.INVALID_ROTATION_TYPE".internationalize(),
    })
    rotation?: ProxyRotation;

    @IsOptional()
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(5, {
        message: "validation.MIN".internationalize(),
    })
    @Max(120, {
        message: "validation.MAX".internationalize(),
    })
    rotationInterval?: number;
}

