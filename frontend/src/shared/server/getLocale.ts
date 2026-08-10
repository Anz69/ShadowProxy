import { headers } from "next/headers"
import { type SupportedLocale } from "@/shared/utils/i18n"
import { defaultLocale } from "@/shared/utils/i18n"

/**
 * Gets locale from headers (set by middleware) or defaults to Russian
 * Used in Server Components to determine user's language
 */
export async function getLocale(): Promise<SupportedLocale> {
	const headersList = await headers()
	
	// Get locale from middleware header
	const locale = headersList.get("x-locale") as SupportedLocale | null
	
	// Return locale from middleware or default (ru)
	return (locale && ["ru", "en", "zh-CN"].includes(locale)) ? locale : defaultLocale
}

