"use client"

import { useQuery } from "@tanstack/react-query"
import { Boxes, DollarSign, Gauge, RefreshCw } from "lucide-react"
import { type FC } from "react"

import ModifyUserBalance from "@/features/admin/components/modals/ModifyUserBalance"
import ModifyUserTraffic from "@/features/admin/components/modals/ModifyUserTraffic"
import ProxyCheckerButton from "@/features/admin/components/support/ProxyCheckerButton"
import { adminSupportService } from "@/features/support/services/admin-support.service"
import type { AdminTicketUser } from "@/features/support/types/admin-support.types"
import type { AdminUser } from "@/features/user/types/user.types"

import Loader from "@/shared/components/ui/Loader/Loader"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { formatDate } from "@/shared/utils/format-date"
import { formatTraffic } from "@/shared/utils/format-traffic"

/**
 * Сайдбар быстрых действий в диалоге поддержки (ТЗ 2.2):
 * а) добавить трафик, б) добавить баланс USDT, в) прокси клиента + история + чекер.
 * Переиспользует существующие админ-модалки (трафик/баланс) — юзер передаётся как AdminUser
 * (модалки читают только id/email/balance/*TrafficLeft, все они есть в AdminTicketUser).
 */
const QuickActions: FC<{ user: AdminTicketUser }> = ({ user }) => {
	const { open } = useModalStore()

	const {
		data: proxies,
		isLoading: proxiesLoading,
		refetch,
		isFetching
	} = useQuery({
		queryKey: ["admin-support-user-proxies", user.id],
		queryFn: () => adminSupportService.getUserProxies(user.id)
	})

	const actionBtn =
		"flex w-full items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08]"

	return (
		<div className="flex w-full flex-col gap-4">
			{/* Карточка юзера */}
			<div className="flex flex-col gap-1.5 rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4">
				<span className="truncate text-[14px] font-semibold text-white">{user.email}</span>
				<span className="text-[12px] text-white/45">ID: {user.id}</span>
				{user.tgLogin && <span className="text-[12px] text-white/45">Telegram: {user.tgLogin}</span>}
				<span className="text-[12px] text-white/45">Баланс: ${Number(user.balance).toFixed(2)}</span>
				<span className="text-[12px] text-white/45">Регистрация: {formatDate(user.createdAt)}</span>
			</div>

			{/* Быстрые действия */}
			<div className="flex flex-col gap-2">
				<button
					type="button"
					className={actionBtn}
					onClick={() => open(<ModifyUserTraffic user={user as unknown as AdminUser} />)}
				>
					<Gauge className="h-4 w-4 text-[#6aa5ff]" />
					Добавить трафик
				</button>
				<button
					type="button"
					className={actionBtn}
					onClick={() => open(<ModifyUserBalance user={user as unknown as AdminUser} />)}
				>
					<DollarSign className="h-4 w-4 text-[#4ade80]" />
					Баланс USDT
				</button>
			</div>

			{/* Прокси клиента + чекер */}
			<div className="flex flex-col gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4">
				<div className="flex items-center justify-between">
					<span className="flex items-center gap-2 text-[14px] font-semibold text-white">
						<Boxes className="h-4 w-4 text-[#6aa5ff]" /> Прокси клиента
					</span>
					<button
						type="button"
						onClick={() => refetch()}
						className="text-white/40 transition-colors hover:text-white"
						aria-label="refresh"
					>
						<RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
					</button>
				</div>

				{proxiesLoading ? (
					<div className="flex justify-center py-4">
						<Loader weight={3} size={30} />
					</div>
				) : !proxies?.proxies.length ? (
					<p className="py-2 text-[13px] text-white/40">Прокси нет</p>
				) : (
					<div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
						{proxies.proxies.map(p => (
							<div key={p.id} className="flex items-start justify-between gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-2.5">
								<div className="flex min-w-0 flex-col">
									<span className="text-[12px] font-semibold text-white">
										{p.type}
										{p.country ? ` · ${p.country}` : ""}
									</span>
									<span className={`text-[11px] ${p.status === "ACTIVE" ? "text-[#4ade80]" : "text-[#ffb020]"}`}>
										{p.status === "ACTIVE" ? "активен" : "приостановлен"} · {p.rotation}
									</span>
									{p.userLogin && (
										<span className="truncate text-[10px] text-white/35" title={`${p.serverHost}:${p.userPort}`}>
											{p.serverHost}:{p.userPort}
										</span>
									)}
									<span className="text-[10px] text-white/35">трафик: {formatTraffic(p.trafficUsed)}</span>
								</div>
								<ProxyCheckerButton proxyId={p.id} />
							</div>
						))}
					</div>
				)}
			</div>

			{/* История генераций */}
			{proxies && proxies.generations.length > 0 && (
				<div className="flex flex-col gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4">
					<span className="text-[14px] font-semibold text-white">История генераций</span>
					<div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
						{proxies.generations.map(g => (
							<div key={g.id} className="flex flex-col rounded-[8px] border border-white/[0.05] px-2.5 py-1.5">
								<span className="text-[12px] text-white/75">
									{g.packageType} × {g.quantity ?? 1}
									{g.location ? ` · ${g.location}` : ""}
								</span>
								<span className="text-[10px] text-white/35">
									{g.rotation}
									{g.rotationInterval ? ` (${g.rotationInterval} мин)` : ""} · {formatDate(g.createdAt, true)}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export default QuickActions
