import type { SupportedLocale } from "./i18n"
import { defaultLocale, supportedLocales } from "./i18n"

/**
 * Extracts locale from URL path
 * Returns locale if found in path, otherwise returns default locale (ru)
 */
export function getLocaleFromPath(pathname: string | null | undefined): SupportedLocale {
	// Handle null/undefined pathname
	if (!pathname) {
		return defaultLocale
	}
	
	// Remove leading slash and split path
	const segments = pathname.split("/").filter(Boolean)
	
	// Check if first segment is a locale
	if (segments.length > 0) {
		const firstSegment = segments[0]
		
		// Handle zh-CN case (it's stored as zh-CN but URL might be /zh/)
		if (firstSegment === "zh" || firstSegment === "zh-CN") {
			return "zh-CN"
		}
		
		// Check if it's a supported locale
		if (supportedLocales.includes(firstSegment as SupportedLocale)) {
			return firstSegment as SupportedLocale
		}
	}
	
	// No locale in path, return default (ru)
	return defaultLocale
}

/**
 * Removes locale prefix from pathname
 * /en/dashboard -> /dashboard
 * /ru/dashboard -> /dashboard
 * /dashboard -> /dashboard
 */
export function removeLocaleFromPath(pathname: string | null | undefined): string {
	if (!pathname) {
		return "/"
	}
	
	const segments = pathname.split("/").filter(Boolean)
	
	if (segments.length > 0) {
		const firstSegment = segments[0]
		
		// Check if first segment is a locale
		if (firstSegment === "zh" || firstSegment === "zh-CN" || supportedLocales.includes(firstSegment as SupportedLocale)) {
			// Remove locale segment
			return "/" + segments.slice(1).join("/")
		}
	}
	
	return pathname
}

/**
 * Adds locale prefix to pathname
 * /dashboard, "en" -> /en/dashboard
 * /dashboard, "ru" -> /dashboard (ru is default, no prefix)
 */
export function addLocaleToPath(pathname: string | null | undefined, locale: SupportedLocale): string {
	// Handle null/undefined pathname
	if (!pathname) {
		return locale === defaultLocale ? "/" : `/${locale === "zh-CN" ? "zh" : locale}/`
	}
	
	// Remove leading slash for processing
	const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname
	
	// Russian is default, no prefix needed
	if (locale === defaultLocale) {
		return "/" + cleanPath
	}
	
	// Map zh-CN to "zh" in URL
	const urlLocale = locale === "zh-CN" ? "zh" : locale
	
	return `/${urlLocale}/${cleanPath}`
}

