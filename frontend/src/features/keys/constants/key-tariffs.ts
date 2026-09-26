export const ACTIVE_KEY_TARIFFS = [
	"RESIDENT_PREMIUM",
	"RESIDENTIAL_LITE",
	"ISP_USA",
	"ISP_EU",
	"PREMIUM_RESIDENTIAL",
	"MOBILE"
] as const

export type ActiveKeyTariff = (typeof ACTIVE_KEY_TARIFFS)[number]

export const KEY_TARIFF_LABELS: Record<ActiveKeyTariff, string> = {
	RESIDENT_PREMIUM: "Residential Proxy",
	RESIDENTIAL_LITE: "Residential Lite",
	ISP_USA: "ISP USA",
	ISP_EU: "ISP Netherlands",
	PREMIUM_RESIDENTIAL: "Premium Residential",
	MOBILE: "Premium Mobile"
}

/** Names kept for previously issued keys. */
export const LEGACY_KEY_TARIFF_LABELS: Record<string, string> = {
	RESIDENT: "Residential (старый тариф)",
	ISP: "ISP (старый тариф)",
	MOBILE_GB: "Mobile GB (старый тариф)",
	IPV6_GB: "IPv6 GB (старый тариф)"
}
