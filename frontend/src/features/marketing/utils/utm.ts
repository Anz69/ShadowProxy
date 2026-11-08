import { getCookie } from "@/shared/utils/getCookie"

export type UtmTouch = {
	utmSource?: string
	utmMedium?: string
	utmCampaign?: string
}

const COOKIE = "utm"

/** Последний UTM-переход (last click) живёт месяц, как и реферальная cookie. */
export function captureUtm(search: string) {
	const params = new URLSearchParams(search)
	const touch: UtmTouch = {
		utmSource: params.get("utm_source")?.trim() || undefined,
		utmMedium: params.get("utm_medium")?.trim() || undefined,
		utmCampaign: params.get("utm_campaign")?.trim() || undefined
	}
	if (!touch.utmSource && !touch.utmMedium && !touch.utmCampaign) return

	const expires = new Date()
	expires.setMonth(expires.getMonth() + 1)
	document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(touch))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

export function readUtm(): UtmTouch {
	const raw = getCookie(COOKIE)
	if (!raw) return {}
	try {
		const parsed = JSON.parse(decodeURIComponent(raw)) as UtmTouch
		return { utmSource: parsed.utmSource, utmMedium: parsed.utmMedium, utmCampaign: parsed.utmCampaign }
	} catch {
		return {}
	}
}

/** Те же метки query-параметрами для /auth/oauth/connect. */
export function appendUtm(url: URL) {
	const utm = readUtm()
	if (utm.utmSource) url.searchParams.set("utm_source", utm.utmSource)
	if (utm.utmMedium) url.searchParams.set("utm_medium", utm.utmMedium)
	if (utm.utmCampaign) url.searchParams.set("utm_campaign", utm.utmCampaign)
	return url
}
