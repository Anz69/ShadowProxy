import type { ResidentTariff } from "@/features/payments/types/payment.types"

export type Proxy = {
	id: string
	host: string
	port: number
	username: string
	password: string
	type: ProxyType
	country: string
	rotation: "BY_TIME" | "AUTO" | "BY_REQUEST"
	rotationInterval: number | null
	rentTime: number | null
	status: "ACTIVE" | "SUSPENDED"
	trafficUsed: string
	userId: string
	createdAt: string
	updatedAt: string
}

export type ProxyType = "RESIDENT" | "RESIDENT_PREMIUM" | "MOBILE" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL"
export type RechargeableProxyType = "RESIDENT" | "RESIDENT_PREMIUM" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL" | "MOBILE"

export type Locations = {
	premium: string[]
	premiumResidential?: string[]
	resident: string[]
	mobile: string[]
	mobileGb?: string[]
	mobile_gb?: string[]
	ipv6: string[]
	isp: string[]
}

export type Plan = {
	id: string
	name: string
	available: boolean
	availablePorts: number
	description: string
	countryCode: string
}

export type Prices = {
	/** @deprecated Residential #1 (Luna) removed; use resident_premium */
	resident?: number
	resident_premium: number
	premium_residential: number
	/** Mobile теперь GB-based (через ProxyEmpire). Раньше был массив time-based опций. */
	mobile: number
	/** Legacy time-based options сохранены для совместимости */
	mobile_legacy_options?: { price: number; rentTime: number }[]
	mobile_gb: number
	ipv6_gb: number
}

export type ProxyStaticLocations =
	| "GLOBAL"
	| "ASIA"
	| "EUROPE"
	| "NORTH_AMERICA"
	| "SOUTH_AMERICA"
	| "AFRICA"

export type IssueMobileGbProxy = {
	location: string
	quantity: number
}

export type IssuePremiumResidentialProxy = {
	location?: string
	region?: string
	city?: string
	isp?: string
	ip_rotation_type?: "random" | "sticky" | "custom"
	session_lifetime?: number
	quantity: number
}

export type IssueMobileV2Proxy = {
	location?: string
	region?: string
	city?: string
	isp?: string
	quantity: number
}

export type IssueIpv6GbProxy = {
	location: string
	quantity: number
}

// Alias for backwards compatibility
export type IssueIspProxy = IssueIpv6GbProxy
