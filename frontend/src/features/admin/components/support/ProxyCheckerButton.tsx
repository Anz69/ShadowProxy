"use client"

import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, XCircle } from "lucide-react"
import { type FC } from "react"

import { adminSupportService } from "@/features/support/services/admin-support.service"

import Loader from "@/shared/components/ui/Loader/Loader"

/** Кнопка «Проверить прокси» (ТЗ 2.3): реальный ответ прокси — IP, страна, ping. */
const ProxyCheckerButton: FC<{ proxyId: string }> = ({ proxyId }) => {
	const { mutate, data, isPending } = useMutation({
		mutationKey: ["support-check-proxy", proxyId],
		mutationFn: () => adminSupportService.checkProxy(proxyId)
	})

	return (
		<div className="flex flex-col items-end gap-1">
			<button
				type="button"
				onClick={() => mutate()}
				disabled={isPending}
				className="inline-flex items-center gap-1.5 rounded-lg border border-[#6aa5ff]/30 bg-[#6aa5ff]/10 px-2.5 py-1 text-[12px] font-semibold text-[#6aa5ff] transition-colors hover:bg-[#6aa5ff]/20 disabled:opacity-50"
			>
				{isPending ? <Loader weight={2} size={14} /> : null}
				Проверить
			</button>
			{data && (
				<div className="flex flex-col items-end text-[11px]">
					{data.works ? (
						<span className="inline-flex items-center gap-1 text-[#4ade80]">
							<CheckCircle2 className="h-3.5 w-3.5" /> Работает
						</span>
					) : (
						<span className="inline-flex items-center gap-1 text-[#ff6b6b]">
							<XCircle className="h-3.5 w-3.5" /> Не работает
						</span>
					)}
					{data.exitIp && <span className="text-white/70">IP: {data.exitIp}</span>}
					{data.country && <span className="text-white/50">{data.country}</span>}
					{data.pingMs != null && <span className="text-white/50">ping: {data.pingMs} мс</span>}
					{data.error && <span className="text-[#ff6b6b]/80">{data.error}</span>}
				</div>
			)}
		</div>
	)
}

export default ProxyCheckerButton
