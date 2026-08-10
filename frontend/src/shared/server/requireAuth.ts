import { redirect } from "next/navigation"
import { headers } from "next/headers"
import type { User } from "@/features/user/types/user.types"
import { getUser } from "./getUser"
import { addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import type { SupportedLocale } from "@/shared/utils/i18n"

const supportedLocales: SupportedLocale[] = ["ru", "en", "zh-CN"]

/**
 * Returns the current user or redirects to login (server-side).
 * Use in protected pages so redirect works even when middleware does not run (e.g. behind some proxies).
 */
export async function requireAuth(): Promise<User> {
	const user = await getUser()
	if (!user) {
		const headersList = await headers()
		const localeHeader = headersList.get("x-locale")
		const locale: SupportedLocale = supportedLocales.includes(localeHeader as SupportedLocale)
			? (localeHeader as SupportedLocale)
			: "ru"
		redirect(addLocaleToPath("/auth/login", locale))
	}
	return user
}
