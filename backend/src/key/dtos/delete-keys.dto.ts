import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class DeleteKeysDto {
    @IsArray()
    @ArrayNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    @IsString({ each: true, message: "validation.NOT_STRING".internationalize() })
    keys: string[];
}
