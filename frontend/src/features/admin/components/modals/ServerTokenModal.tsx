"use client"

import type { FC } from "react"
import { useState } from "react"
import { Copy, Check } from "lucide-react"

type ServerTokenModalProps = {
	token: string
	serverHost: string
}

const ServerTokenModal: FC<ServerTokenModalProps> = ({ token, serverHost }) => {
	const [copied, setCopied] = useState(false)

	const handleCopy = () => {
		navigator.clipboard.writeText(token)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	return (
		<div className="flex w-full flex-col items-center gap-4">
			<h2 className="font-[TalosDisplay] text-2xl font-semibold text-white">
				Токен для сервера
			</h2>
			<p className="text-lg text-white/70">
				{serverHost}
			</p>
			<div className="w-full">
				<div className="relative flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] p-4">
					<code className="flex-1 break-all font-mono text-lg text-white">
						{token}
					</code>
					<button
						onClick={handleCopy}
						className="flex-shrink-0 rounded-[8px] p-2 transition-colors hover:bg-white/10"
						title="Копировать токен"
					>
						{copied ? (
							<Check className="h-5 w-5 text-emerald-400" />
						) : (
							<Copy className="h-5 w-5 text-white/70" />
						)}
					</button>
				</div>
			</div>
			<p className="text-center text-sm text-white/45">
				Токен автоматически скопирован в буфер обмена
			</p>
		</div>
	)
}

export default ServerTokenModal

