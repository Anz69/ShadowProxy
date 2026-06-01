import { IsEnum } from "class-validator";
import { PackageType } from "@prisma/client";

export class GetTrialDto {
    @IsEnum(PackageType)
    tariffType: PackageType;
}


