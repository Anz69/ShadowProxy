"use client"

import { usePathname } from "next/navigation"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"

/**
 * Hook to get localized link based on current locale
 */
export function useLocalizedLink() {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	
	return (path: string) => {
		return addLocaleToPath(path, currentLocale)
	}
}

