"use client"

import { FileChartColumnIncreasing, MoreHorizontal, Pen, Receipt } from "lucide-react"
import { type FC } from "react"

import ModifyUserBalance from "@/features/admin/components/modals/ModifyUserBalance"
import ModifyUserTraffic from "@/features/admin/components/modals/ModifyUserTraffic"
import Statistics from "@/features/admin/components/modals/Statistics"
import TransactionsModal from "@/features/admin/components/modals/TransactionsModal"
import type { AdminUser } from "@/features/user/types/user.types"

import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import Select from "@/shared/components/ui/Select"
import { formatDate } from "@/shared/utils/format-date"
import { formatTraffic } from "@/shared/utils/format-traffic"

type UsersTableProps = {
	users: AdminUser[]
}

// Подписи трафика в порядке отображения. Совпадают с реальными полями баланса и
// с наименованиями из модалки изменения трафика (premiumTrafficLeft = Residential, а
// не «Premium»). Новые типы (ISP USA/EU, Residential Lite) добавлены.
const TRAFFIC_FIELDS: { key: keyof AdminUser; label: string }[] = [
	{ key: "premiumTrafficLeft", label: "Residential" },
	{ key: "premiumResidentialTrafficLeft", label: "Premium Res" },
	{ key: "ispUsaTrafficLeft", label: "ISP USA" },
	{ key: "ispEuTrafficLeft", label: "ISP EU" },
	{ key: "residentialLiteTrafficLeft", label: "Res. Lite" },
	{ key: "mobileGbTrafficLeft", label: "Mobile GB" },
	{ key: "mobileTrafficLeft", label: "Mobile" },
	{ key: "ipv6GbTrafficLeft", label: "IPv6" }
]

const UserActions: FC<{ user: AdminUser }> = ({ user }) => {
	const { open } = useModalStore()

	const handleAction = (action: string) => {
		if (action === "transactions") open(<TransactionsModal userId={user.id} />)
		if (action === "statistics") open(<Statistics userId={user.id} />)
	}

	return (
		<Select
			value=""
			onChange={handleAction}
			size="small"
			placeholder={<span className="flex items-center gap-2"><MoreHorizontal className="h-4 w-4" /> Действия</span>}
			ariaLabel={`Действия с пользователем ${user.email}`}
			className="!w-[142px]"
			buttonClassName="!h-9 !border !border-white/15 !bg-white/[0.04] !px-3 hover:!border-[#4f8dff]/60 hover:!bg-[#4f8dff]/10"
		>
			<Select.Option value="transactions"><Receipt className="h-4 w-4 text-[#6aa5ff]" />Транзакции</Select.Option>
			<Select.Option value="statistics"><FileChartColumnIncreasing className="h-4 w-4 text-[#6aa5ff]" />Статистика</Select.Option>
		</Select>
	)
}

const UsersTable: FC<UsersTableProps> = ({ users }) => {
	const { open } = useModalStore()

	return (
		<div className="w-full min-w-0 max-w-full overflow-x-auto rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
			<table className="w-full min-w-[1180px] table-fixed border-collapse text-left">
				<colgroup>
					<col className="w-[17%]" /><col className="w-[31%]" /><col className="w-[8%]" />
					<col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[11%]" /><col className="w-[15%]" />
				</colgroup>
				<thead>
					<tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.06em] text-white/35">
						<th className="px-3 py-3 font-medium whitespace-nowrap">Email</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">Трафик</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">Баланс</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">Моб. прокси</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">Авторизация</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">Дата регистрации</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">Управление</th>
					</tr>
				</thead>
				<tbody className="text-[13px] text-white/75">
					{/* Порядок приходит с сервера (sortBy/sortDir) — клиентский sort ломал бы его. */}
				{users.map(el => (
						<tr
							key={el.id}
							className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]"
						>
							<td className="px-3 py-3 break-all">{el.email}</td>
							<td className="px-3 py-3">
								<div className="flex items-start gap-2">
									<div className="grid min-w-0 flex-1 grid-cols-4 gap-x-1 gap-y-2">
									{TRAFFIC_FIELDS.map(f => (
											<div key={f.key} className="flex min-w-0 flex-col border-l border-white/10 px-2 first:border-l-0">
												<span className="text-body text-sm leading-4 font-semibold whitespace-nowrap">
													{formatTraffic((el[f.key] as string) || "0")}
												</span>
												<span className="text-body/50 text-[11px] font-medium whitespace-nowrap">
													{f.label}
												</span>
											</div>
									))}
									</div>
									<Pen
										className="text-body size-3.5 cursor-pointer self-start duration-200 hover:brightness-80"
										onClick={() =>
											open(
												<ModifyUserTraffic user={el} />
											)
										}
									/>
								</div>
							</td>
						<td className="px-3 py-3">
							<div className="flex flex-row items-center gap-2">
								<span className="text-body text-sm font-semibold">
									${Number(el.balance || 0).toFixed(2)}
								</span>
								<Pen
									className="text-body size-3.5 cursor-pointer duration-200 hover:brightness-80"
									onClick={() =>
										open(
											<ModifyUserBalance user={el} />
										)
									}
								/>
							</div>
						</td>
						<td className="px-3 py-3">
							{el.mobileProxiesCount > 0
								? `${el.mobileProxiesCount} акт.`
								: "Нет активных"}
						</td>
							<td className="px-3 py-3">
								{el.authMethod === "CREDENTIALS"
									? "Email + пароль"
									: el.authMethod === "TELEGRAM"
										? "Telegram"
										: "Google"}
							</td>
							<td className="px-3 py-3 whitespace-nowrap">
								{formatDate(el.createdAt)}
							</td>
							<td className="px-3 py-3">
								<UserActions user={el} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

export default UsersTable
