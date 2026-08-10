"use client"

import { FileChartColumnIncreasing, Pen, Receipt, Wallet } from "lucide-react"
import { Fragment, type FC } from "react"

import ModifyUserBalance from "@/features/admin/components/modals/ModifyUserBalance"
import ModifyUserTraffic from "@/features/admin/components/modals/ModifyUserTraffic"
import Statistics from "@/features/admin/components/modals/Statistics"
import TransactionsModal from "@/features/admin/components/modals/TransactionsModal"
import type { AdminUser } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
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

const UsersTable: FC<UsersTableProps> = ({ users }) => {
	const { open } = useModalStore()

	return (
		<div className="w-full min-w-0 max-w-full overflow-x-auto rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
			<table className="w-full border-collapse text-left">
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
							<td className="px-3 py-3 whitespace-nowrap">{el.email}</td>
							<td className="px-3 py-3">
								<div className="flex h-9 flex-row items-center gap-2">
									{TRAFFIC_FIELDS.map((f, idx) => (
										<Fragment key={f.key}>
											{idx > 0 && (
												<div className="bg-body/25 h-9 w-px shrink-0 self-stretch rounded-sm" />
											)}
											<div className="flex flex-col items-center text-center">
												<span className="text-body text-sm leading-4 font-semibold whitespace-nowrap">
													{formatTraffic((el[f.key] as string) || "0")}
												</span>
												<span className="text-body/50 text-[11px] font-medium whitespace-nowrap">
													{f.label}
												</span>
											</div>
										</Fragment>
									))}
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
								<div className="flex flex-row items-center gap-2 whitespace-nowrap">
									<Button
										variant="outline"
										type="button"
										className="!h-8 !w-auto !px-3 !text-sm gap-1 whitespace-nowrap"
										onClick={() =>
											open(
												<TransactionsModal userId={el.id} />
											)
										}
									>
										<Receipt className="h-4 w-4" />
										Транзакции
									</Button>
									<Button
										variant="outline"
										type="button"
										className="!h-8 !w-auto !px-3 !text-sm gap-1 whitespace-nowrap"
										onClick={() =>
											open(
												<Statistics userId={el.id} />
											)
										}
									>
										<FileChartColumnIncreasing className="h-4 w-4" />
										Статистика
									</Button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

export default UsersTable
