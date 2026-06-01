"use client"

import { getLocaleFromPath, addLocaleToPath } from "./getLocaleFromPath"

/**
 * Get localized path based on current pathname
 * This is a client-side utility that can be used in hooks and client components
 */
export function getLocalizedPath(pathname: string, targetPath: string): string {
	const currentLocale = getLocaleFromPath(pathname)
	return addLocaleToPath(targetPath, currentLocale)
}

