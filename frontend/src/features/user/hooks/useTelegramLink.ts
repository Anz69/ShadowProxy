import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { accountLinkService } from "@/features/user/services/account-link.service"

const BOT_ID = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID

/**
 * Привязка Telegram к текущему юзеру. startLink() редиректит в oauth.telegram.org
 * с маркером ?tglink=1; при возврате хук парсит #tgAuthResult= и POST'ит на /auth/link/telegram.
 */
export function useTelegramLink(onDone?: () => void) {
	const [isProcessing, setIsProcessing] = useState(false)

	useEffect(() => {
		if (typeof window === "undefined") return
		const params = new URLSearchParams(window.location.search)
		if (params.get("tglink") !== "1") return
		const hash = window.location.hash
		if (!hash.startsWith("#tgAuthResult=")) return

		const authResult = hash.substring("#tgAuthResult=".length)
		const cleanUrl = () =>
			window.history.replaceState(null, "", window.location.pathname)

		if (authResult === "false") {
			cleanUrl()
			return
		}
		setIsProcessing(true)
		try {
			const userData = JSON.parse(atob(authResult))
			accountLinkService
				.linkTelegram(userData)
				.then(() => {
					toast.success("Telegram привязан")
					cleanUrl()
					onDone?.()
				})
				.catch((e: Error) => {
					toast.error(e.message || "Не удалось привязать Telegram")
					cleanUrl()
				})
				.finally(() => setIsProcessing(false))
		} catch {
			setIsProcessing(false)
			cleanUrl()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const startLink = () => {
		if (!BOT_ID) {
			toast.error("Telegram бот не настроен")
			return
		}
		const origin = window.location.origin
		const base = `${window.location.origin}${window.location.pathname}`
		const returnTo = `${base}?tglink=1`
		const url = `https://oauth.telegram.org/auth?bot_id=${BOT_ID}&origin=${encodeURIComponent(
			origin
		)}&request_access=write&return_to=${encodeURIComponent(returnTo)}`
		window.location.href = url
	}

	return { startLink, isProcessing }
}
