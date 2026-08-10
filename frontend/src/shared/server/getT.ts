import { getLocale } from "./getLocale"
import { t } from "../utils/i18n"

/**
 * Server-side helper to get translation function with locale already bound
 * Usage: const T = await getT(); <h1>{T("main.hero.title")}</h1>
 */
export async function getT() {
	const locale = await getLocale()
	return (key: string) => t(key, locale)
}

