import { Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional, IsPositive, ValidateNested } from "class-validator";

class MobilePriceDto {
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    price: number;

    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    rentTime: number;
}

export class ModifyPricesDto {
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    resident_premium: number;

    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    mobile_gb: number;

    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    ipv6_gb: number;

    @IsOptional()
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    premium_residential?: number;

    @IsOptional()
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    isp_usa?: number;

    @IsOptional()
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    isp_eu?: number;

    @IsOptional()
    @IsNumber({}, { message: "validation.NOT_NUMBER".internationalize() })
    @IsPositive({ message: "validation.NOT_POSITIVE".internationalize() })
    residential_lite?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MobilePriceDto)
    mobile?: MobilePriceDto[];
}
