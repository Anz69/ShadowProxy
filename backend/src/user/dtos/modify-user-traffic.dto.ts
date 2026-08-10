import { IsNumber, IsOptional, Min } from "class-validator";

export class ModifyUserTrafficDto {
    @IsNumber(
        {},
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0, {
        message: "validation.MIN".internationalize(),
    })
    premiumTrafficLeft: number;

    @IsNumber(
        {},
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0, {
        message: "validation.MIN".internationalize(),
    })
    mobileGbTrafficLeft: number;

    @IsNumber(
        {},
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0, {
        message: "validation.MIN".internationalize(),
    })
    ipv6GbTrafficLeft: number;

    @IsOptional()
    @IsNumber(
        {},
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0, {
        message: "validation.MIN".internationalize(),
    })
    premiumResidentialTrafficLeft?: number;

    @IsOptional()
    @IsNumber(
        {},
        {
            message: "validation.NOT_NUMBER".internationalize(),
        },
    )
    @Min(0, {
        message: "validation.MIN".internationalize(),
    })
    mobileTrafficLeft?: number;

    @IsOptional()
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @Min(0, { message: "validation.MIN".internationalize() })
    ispUsaTrafficLeft?: number;

    @IsOptional()
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @Min(0, { message: "validation.MIN".internationalize() })
    ispEuTrafficLeft?: number;

    @IsOptional()
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @Min(0, { message: "validation.MIN".internationalize() })
    residentialLiteTrafficLeft?: number;
}
