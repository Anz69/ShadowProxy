"use client"

import { useEffect, useState } from "react"
import type { SupportedLocale } from "@/shared/utils/i18n"

const defaultLocaleValue: SupportedLocale = "ru"

/**
 * Hook to get current locale on client side
 * In a real implementation, this would read from cookies or URL
 */
export function useLocale(): SupportedLocale {
	const [locale, setLocale] = useState<SupportedLocale>(defaultLocaleValue)

	useEffect(() => {
		// Try to get locale from cookie or localStorage
		const stored = localStorage.getItem("locale")
		if (stored && ["en", "ru", "zh-CN"].includes(stored)) {
			setLocale(stored as SupportedLocale)
		} else {
			// Detect from browser
			const browserLang = navigator.language.toLowerCase()
			if (browserLang.startsWith("ru")) {
				setLocale("ru")
			} else if (browserLang.startsWith("zh")) {
				setLocale("zh-CN")
			} else if (browserLang.startsWith("en")) {
				setLocale("en")
			} else {
				setLocale("ru") // Default to Russian
			}
		}
	}, [])

	return locale
}

/**
 * Hook to set locale on client side
 */
export function useSetLocale() {
	return (locale: SupportedLocale) => {
		localStorage.setItem("locale", locale)
		window.location.reload() // Reload to apply new locale
	}
}

