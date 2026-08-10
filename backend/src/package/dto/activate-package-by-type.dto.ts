import { IsNotEmpty } from "class-validator";
import { PackageType } from "@prisma/client";
import { Validate } from "class-validator";
import { IsPackageTypeValidConstraint } from "./is-package-type-valid-constraint";

export class ActivatePackageByTypeDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @Validate(IsPackageTypeValidConstraint, {
        message: "validation.UNKNOWN_PROXY_TARIFF".internationalize(),
    })
    type: PackageType;
}

