import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

/**
 * Сортируемые поля админ-списка пользователей (ТЗ п.3.3).
 * Трафик-поля хранятся строками (байты) — сортировка по ним идёт raw-запросом с CAST,
 * поэтому список фиксированный (whitelist, никакого SQL из клиента).
 */
export const ADMIN_USERS_SORT_FIELDS = [
    "createdAt",
    "balance",
    "premiumTrafficLeft",
    "premiumResidentialTrafficLeft",
    "mobileGbTrafficLeft",
    "mobileTrafficLeft",
    "ipv6GbTrafficLeft",
    "ispUsaTrafficLeft",
    "ispEuTrafficLeft",
    "residentialLiteTrafficLeft",
] as const;
export type AdminUsersSortField = (typeof ADMIN_USERS_SORT_FIELDS)[number];

export class GetAdminUsersDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit: number = 50;

    /** Поиск: точный id, email (substring, без регистра), telegram-логин (substring). */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    search?: string;

    @IsOptional()
    @IsIn(ADMIN_USERS_SORT_FIELDS as unknown as string[])
    sortBy: AdminUsersSortField = "createdAt";

    @IsOptional()
    @IsIn(["asc", "desc"])
    sortDir: "asc" | "desc" = "desc";
}
