import { IsOptional, IsString, IsInt, Min } from "class-validator";

export class GetTrafficDto {
    @IsOptional()
    @IsString({
        message: "validation.NOT_STRING".internationalize(),
    })
    packageId?: string;

    @IsOptional()
    @IsInt({
        message: "validation.NOT_INT".internationalize(),
    })
    @Min(1, {
        message: "validation.MIN".internationalize(),
    })
    week?: number;
}

