"use client"

import { type FC } from "react"

type TelegramLoginWidgetProps = {
	botName: string
	requestAccess?: boolean
	buttonText?: string
}

const TelegramLoginWidget: FC<TelegramLoginWidgetProps> = ({
	botName,
	requestAccess = true,
	buttonText = "Войти через Telegram"
}) => {
	const botId = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID

	const handleButtonClick = () => {
		if (!botId) return

		const telegramOrigin = process.env.NEXT_PUBLIC_TELEGRAM_ORIGIN
		console.log("telegramOrigin", telegramOrigin)
		const origin = window.location.origin//telegramOrigin || (typeof window !== "undefined" ? window.location.origin : "")
		console.log("origin", origin)
		const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : ""
		const returnTo = telegramOrigin ? `${telegramOrigin}${currentPath}` : (typeof window !== "undefined" ? window.location.href : "")

		const oauthUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(origin)}&request_access=${requestAccess ? "write" : "read"}&return_to=${encodeURIComponent(returnTo)}`

		if (typeof window !== "undefined") {
			window.location.href = oauthUrl
		}
	}

	return (
		<button
			type="button"
			className="inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] text-[15px] font-medium text-white transition hover:border-white/20 hover:bg-white/[0.07] light:border-[#e2e4ea] light:bg-[#f7f8fb] light:text-[#0e1019] light:hover:border-[#d8dde6] light:hover:bg-[#eef1f6]"
			disabled={!botId}
			onClick={handleButtonClick}
		>
			<img
				src="/telegram-icon.svg"
				alt=""
				width={20}
				height={20}
			/>
			<span>{buttonText}</span>
		</button>
	)
}

export default TelegramLoginWidget

