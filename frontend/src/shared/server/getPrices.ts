import type { Prices } from "@/features/proxy/types/proxy.types"

// Fallback-цены: используются если бэкенд недоступен или вернул ошибку,
// чтобы SSR главной/оплаты не падал с server-side exception.
const FALLBACK_PRICES: Prices = {
	resident_premium: 0,
	premium_residential: 0,
	mobile: 0,
	mobile_gb: 0,
	ipv6_gb: 0
}

export async function getPrices(): Promise<Prices> {
	const backendUri = process.env.NEXT_PUBLIC_BACKEND_URI
	if (!backendUri) {
		console.error("getPrices: NEXT_PUBLIC_BACKEND_URI is not set")
		return FALLBACK_PRICES
	}

	try {
		const res = await fetch(`${backendUri}/proxy/prices`, {
			// no-store — всегда свежие цены, чтобы после изменения в админке сразу показывались новые значения
			cache: "no-store"
		})

		if (!res.ok) {
			console.error(`getPrices: API returned ${res.status} ${res.statusText}`)
			return FALLBACK_PRICES
		}

		const data = (await res.json()) as Partial<Prices> | null
		if (!data || typeof data !== "object") {
			console.error("getPrices: unexpected response shape")
			return FALLBACK_PRICES
		}

		// Сливаем с fallback, чтобы любые отсутствующие ключи были числами (а не undefined),
		// иначе потребители вроде cheapestPricePerGb могут получить NaN/ошибки.
		return { ...FALLBACK_PRICES, ...data }
	} catch (err) {
		console.error(
			`getPrices fetch failed: ${err instanceof Error ? `${err.name} - ${err.message}` : String(err)}`
		)
		return FALLBACK_PRICES
	}
}
