import ru from "@/translates/ru.json"
import en from "@/translates/en.json"
import zhCN from "@/translates/zh-CN.json"

export type Translation = typeof en
export type TranslationKey = string

const translations = {
	ru,
	en,
	"zh-CN": zhCN,
} as const

export type SupportedLocale = keyof typeof translations

export const defaultLocale: SupportedLocale = "ru"
export const supportedLocales: SupportedLocale[] = ["ru", "en", "zh-CN"]

/**
 * Gets translation object for a specific locale
 */
export function getTranslations(locale: SupportedLocale = defaultLocale): Translation {
	return translations[locale] || translations[defaultLocale]
}

/**
 * Gets nested translation value by key path (e.g., "header.nav.prices")
 * Supports parameters replacement: {{paramName}}
 */
export function t(
	key: string,
	locale: SupportedLocale = defaultLocale,
	params?: Record<string, string>
): string {
	const translation = getTranslations(locale)
	const keys = key.split(".")
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let value: any = translation
	for (const k of keys) {
		value = value?.[k]
		if (value === undefined) {
			// Fallback to English if key not found
			const fallback = getTranslations(defaultLocale)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let fallbackValue: any = fallback
			for (const fk of keys) {
				fallbackValue = fallbackValue?.[fk]
			}
			value = typeof fallbackValue === "string" ? fallbackValue : key
			break
		}
	}

	let result = typeof value === "string" ? value : key
	
	// Replace parameters if provided
	if (params) {
		for (const [paramKey, paramValue] of Object.entries(params)) {
			result = result.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"), paramValue)
		}
	}

	return result
}

/**
 * Gets translation with HTML support (returns string that can be used with dangerouslySetInnerHTML)
 */
export function tHTML(
	key: string,
	locale: SupportedLocale = defaultLocale
): string {
	return t(key, locale)
}

