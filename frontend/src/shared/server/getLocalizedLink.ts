import { getLocale } from "./getLocale"
import { addLocaleToPath } from "../utils/getLocaleFromPath"

/**
 * Server-side helper to get localized link
 * Usage: const link = await getLocalizedLink("/u-api")
 */
export async function getLocalizedLink(path: string): Promise<string> {
	const locale = await getLocale()
	return addLocaleToPath(path, locale)
}

