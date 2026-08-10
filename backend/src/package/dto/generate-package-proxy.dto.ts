import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export enum ProxyRotation {
    BY_REQUEST = "BY_REQUEST",
    BY_TIME = "BY_TIME",
}

export class GeneratePackageProxyDto {
    location?: string;

    @IsOptional()
    @IsEnum(ProxyRotation, {
        message: "validation.INVALID_ROTATION_TYPE".internationalize(),
    })
    rotation?: ProxyRotation;

    @IsOptional()
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(1, {
        message: "validation.MIN".internationalize(),
    })
    quantity?: number;

    @IsOptional()
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(5, {
        message: "validation.MIN".internationalize(),
    })
    rotationInterval?: number;

    @IsOptional() @IsString() region?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() isp?: string;
}


