import { IsNotEmpty, IsObject } from "class-validator";

export class SetSettingDto {
    @IsNotEmpty({
        message: "validation.NOT_EMPTY".internationalize(),
    })
    key: string;

    @IsObject({
        message: "validation.NOT_OBJECT".internationalize(),
    })
    value: object | any[];
}
