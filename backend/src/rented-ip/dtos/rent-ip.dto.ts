import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class RentIpDto {
    @IsIn(["IPV4", "IPV6"], { message: "validation.UNKNOWN_IP_FAMILY".internationalize() })
    family: "IPV4" | "IPV6";

    @IsInt({ message: "validation.NOT_NUMBER".internationalize() })
    @Min(1, { message: "validation.MIN".internationalize() })
    @Max(100, { message: "validation.MAX".internationalize() })
    quantity: number;

    // Срок аренды в днях (кратно периоду тарификации). По умолчанию — 30.
    @IsOptional()
    @IsInt({ message: "validation.NOT_NUMBER".internationalize() })
    @Min(1, { message: "validation.MIN".internationalize() })
    @Max(365, { message: "validation.MAX".internationalize() })
    periodDays?: number;

    @IsOptional()
    @IsBoolean()
    autoRenew?: boolean;
}
