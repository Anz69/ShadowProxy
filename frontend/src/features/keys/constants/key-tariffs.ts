export const ACTIVE_KEY_TARIFFS = [
	"RESIDENT_PREMIUM",
	"RESIDENTIAL_LITE",
	"ISP_USA",
	"PREMIUM_RESIDENTIAL",
	"MOBILE"
] as const

export type ActiveKeyTariff = (typeof ACTIVE_KEY_TARIFFS)[number]

export const KEY_TARIFF_LABELS: Record<ActiveKeyTariff, string> = {
	// Старый «Премиум» (Mango) — теперь обычный Residential Proxy, продаётся и по ключам.
	RESIDENT_PREMIUM: "Residential Proxy",
	RESIDENTIAL_LITE: "Residential Lite",
	ISP_USA: "ISP USA",
	PREMIUM_RESIDENTIAL: "Premium Residential",
	MOBILE: "Premium Mobile"
}

/** Names kept for previously issued keys. */
export const LEGACY_KEY_TARIFF_LABELS: Record<string, string> = {
	RESIDENT: "Residential (старый тариф)",
	ISP_EU: "ISP Netherlands (временно недоступен)",
	ISP: "ISP (старый тариф)",
	MOBILE_GB: "Mobile GB (старый тариф)",
	IPV6_GB: "IPv6 GB (старый тариф)"
}
