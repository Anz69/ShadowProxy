import { IsEmail, IsIn, IsNotEmpty, IsOptional, MinLength } from "class-validator";

export const STAFF_ROLES = ["SUPPORT", "SMM"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export class CreateSupportAccountDto {
    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    @IsEmail({}, { message: "validation.INVALID_EMAIL".internationalize() })
    email: string;

    @IsNotEmpty({ message: "validation.NOT_EMPTY".internationalize() })
    @MinLength(8, { message: "validation.MIN_LENGTH".internationalize() })
    password: string;

    /** SUPPORT — только раздел «Поддержка», SMM — только «Маркетинг / UTM». По умолчанию SUPPORT. */
    @IsOptional()
    @IsIn(STAFF_ROLES, { message: "validation.INVALID_VALUE".internationalize() })
    role?: StaffRole;
}
