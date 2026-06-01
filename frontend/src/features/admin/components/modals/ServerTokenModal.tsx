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
			<h2 className="text-body text-2xl font-semibold">
				Токен для сервера
			</h2>
			<p className="text-body/70 text-lg">
				{serverHost}
			</p>
			<div className="w-full">
				<div className="relative flex items-center gap-2 rounded-lg border-2 border-body/25 bg-input p-4">
					<code className="flex-1 break-all text-lg font-mono text-body">
						{token}
					</code>
					<button
						onClick={handleCopy}
						className="flex-shrink-0 rounded-md p-2 hover:bg-body/10 transition-colors"
						title="Копировать токен"
					>
						{copied ? (
							<Check className="h-5 w-5 text-green-500" />
						) : (
							<Copy className="h-5 w-5 text-body/70" />
						)}
					</button>
				</div>
			</div>
			<p className="text-body/50 text-sm text-center">
				Токен автоматически скопирован в буфер обмена
			</p>
		</div>
	)
}

export default ServerTokenModal

