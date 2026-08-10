import type { Account } from "@/features/auth/types/auth.types"

export type UserStats = {
	hour: string
	day: string
	week: string
	month: string
}

export enum UserRole {
	User = "USER",
	Admin = "ADMIN",
	Banned = "BANNED"
}

export enum AuthMethod {
	Credentials = "CREDENTIALS",
	Google = "GOOGLE",
	Telegram = "TELEGRAM"
}

export enum UserRegion {
	Cis = "CIS",
	Europe = "EUROPE",
	Usa = "USA"
}

export type User = {
	id: string
	email: string
	authMethod: AuthMethod
	role: UserRole
	emailVerified: boolean
	residentTrafficLeft: string
	premiumTrafficLeft: string
	premiumResidentialTrafficLeft: string
	mobileTrafficLeft: string
	ispIpLeft: number
	mobileGbTrafficLeft: string
	ipv6GbTrafficLeft: string
	ispUsaTrafficLeft?: string
	ispEuTrafficLeft?: string
	residentialLiteTrafficLeft?: string
	trial: string | null
	tgLogin: string | null
	region: UserRegion
	balance: string
	referralBalance: string
	trialDiscountAvailable: boolean
	reviewDiscountAvailable: boolean
	createdAt: string
	updatedAt: string
	account: Account[]
	accounts?: Account[]
}

/**
 * Юзер в админ-списке. Лёгкая форма: payments/proxies/stats больше НЕ приходят
 * списком (это грузило всех юзеров с полными связями и лагало) — транзакции и
 * статистика подгружаются лениво из модалок по отдельным эндпоинтам.
 */
export type AdminUser = User & { mobileProxiesCount: number }

export type AdminUsersSortField =
	| "createdAt"
	| "balance"
	| "premiumTrafficLeft"
	| "premiumResidentialTrafficLeft"
	| "mobileGbTrafficLeft"
	| "mobileTrafficLeft"
	| "ipv6GbTrafficLeft"
	| "ispUsaTrafficLeft"
	| "ispEuTrafficLeft"
	| "residentialLiteTrafficLeft"

export type AdminUsersParams = {
	page: number
	limit: number
	search?: string
	sortBy: AdminUsersSortField
	sortDir: "asc" | "desc"
}

export type AdminUsersResponse = {
	users: AdminUser[]
	total: number
	page: number
	limit: number
}
