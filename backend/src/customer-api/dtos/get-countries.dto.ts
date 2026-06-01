import { IsEnum, IsNotEmpty } from "class-validator";
import { PackageType } from "@prisma/client";

export class GetCountriesDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsEnum(PackageType, {
        message: "validation.INVALID_PACKAGE_TYPE".internationalize(),
    })
    packageType: PackageType;
}

