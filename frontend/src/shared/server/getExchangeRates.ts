import type { ExchangeRates } from "@/features/payments/types/payment.types"

const FALLBACK: ExchangeRates = { TON: 1, BTC: 1, ETH: 1, LTC: 1, BNB: 1, TRX: 1 }

export async function getExchangeRates(): Promise<ExchangeRates> {
	const backendUri = process.env.NEXT_PUBLIC_BACKEND_URI
	if (!backendUri) return FALLBACK

	try {
		const res = await fetch(`${backendUri}/payments/exchange-rates`, {
			next: { revalidate: 60 }
		})
		if (!res.ok) return FALLBACK
		const rates = await res.json()
		return rates && typeof rates === "object" ? rates : FALLBACK
	} catch (err) {
		console.error(`getExchangeRates fetch failed: ${err instanceof Error ? err.message : String(err)}`)
		return FALLBACK
	}
}
