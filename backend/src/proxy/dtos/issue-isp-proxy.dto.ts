import { IsInt, IsNotEmpty, Max, Min, MinLength, Validate } from "class-validator";
import { IsIso31661Alpha2Constraint } from "./is-iso3166-1_a-2-constraint";

export class IssueIspProxyDto {
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
}
