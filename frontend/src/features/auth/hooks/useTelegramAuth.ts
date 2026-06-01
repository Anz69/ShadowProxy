import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { getCookie } from "@/shared/utils/getCookie"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"
import { t } from "@/shared/utils/i18n"

type TelegramUser = {
	id: number
	first_name: string
	last_name?: string
	username?: string
	photo_url?: string
	auth_date: number
	hash: string
}

export function useTelegramAuth() {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const [isProcessing, setIsProcessing] = useState(false)

	useEffect(() => {
		if (typeof window === "undefined") return

		const hash = window.location.hash
		if (!hash || !hash.startsWith("#tgAuthResult=")) return

		const authResult = hash.substring("#tgAuthResult=".length)
		
		if (authResult === "false") {
			window.history.replaceState(null, "", window.location.pathname)
			return
		}

		setIsProcessing(true)

		try {
			const decoded = atob(authResult)
			const userData: TelegramUser = JSON.parse(decoded)
			const referrerId = getCookie("referrer")

			fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/auth/telegram`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				credentials: "include",
				body: JSON.stringify({
					...userData,
					referrerId: referrerId || undefined
				})
			})
				.then(async (res) => {
					if (!res.ok) {
						const errorData = await res.json().catch(() => ({}))
						throw new Error(errorData.message || t("validation.telegramAuthError", locale))
					}
					const localizedPath = getLocalizedPath(pathname, "/dashboard")
					window.location.href = localizedPath
				})
				.catch((error) => {
					console.error("Telegram auth error:", error)
					setIsProcessing(false)
				})
		} catch (error) {
			console.error("Failed to parse Telegram auth result:", error)
			setIsProcessing(false)
		}
	}, [pathname, locale])

	return { isProcessing }
}

