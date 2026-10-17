"use client"

import { useMutation } from "@tanstack/react-query"
import { RefreshCw, Wallet } from "lucide-react"
import { type FC } from "react"

import { adminService } from "@/features/admin/serices/admin.service"

import Card from "@/shared/components/ui/Card"

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v)

/** Кнопка проверки баланса агентского аккаунта Mango (ТЗ: кнопка в админ-панели). */
const MangoBalanceCard: FC = () => {
	const check = useMutation({ mutationFn: () => adminService.getMangoBalance() })
	const info = check.data
	const rows = info && isPlainObject(info.data) ? Object.entries(info.data) : []

	return (
		<Card className="relative overflow-hidden !py-5">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#6aa5ff]/25 bg-[#2f6bff]/10 text-[#8db8ff]">
						<Wallet className="h-5 w-5" aria-hidden="true" />
					</span>
					<div>
						<p className="text-[15px] font-medium text-white">Баланс Mango</p>
						<p className="text-xs text-white/45">Запрос к агентскому API Mango (/parent_account_info)</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => check.mutate()}
					disabled={check.isPending}
					className="inline-flex items-center gap-2 rounded-[12px] bg-[#2f6bff] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2558d6] disabled:opacity-60"
				>
					<RefreshCw className={`h-4 w-4 ${check.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
					{check.isPending ? "Проверяем…" : "Проверить баланс"}
				</button>
			</div>

			{check.isError && (
				<p className="mt-4 text-sm text-[#ff7b7b]">{(check.error as Error).message}</p>
			)}
			{info && (
				<div className="mt-4 rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4 text-sm">
					<p className={info.ok ? "text-emerald-300" : "text-[#ff7b7b]"}>
						{info.ok ? "Mango API ответил" : "Mango API недоступен"} · HTTP {info.status ?? "—"} · {info.ms} мс
						{info.message ? ` · ${String(info.message)}` : ""}
					</p>
					{rows.length > 0 ? (
						<dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
							{rows.map(([key, value]) => (
								<div key={key} className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-1">
									<dt className="text-white/45">{key}</dt>
									<dd className="font-mono text-white/85">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
								</div>
							))}
						</dl>
					) : (
						info.data !== undefined && (
							<pre className="mt-3 max-h-48 overflow-auto font-mono text-xs text-white/70">{JSON.stringify(info.data, null, 2)}</pre>
						)
					)}
				</div>
			)}
		</Card>
	)
}

export default MangoBalanceCard
