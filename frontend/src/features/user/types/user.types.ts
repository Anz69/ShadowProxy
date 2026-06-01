import type { Account } from "@/features/auth/types/auth.types"
import type { Invoice } from "@/features/payments/types/payment.types"
import type { Proxy } from "@/features/proxy/types/proxy.types"

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

export type AdminUser = User & { stats: UserStats } & { proxies: Proxy[] } & {
	payments: Invoice[]
}
