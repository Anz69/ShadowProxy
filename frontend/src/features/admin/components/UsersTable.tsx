"use client"

import {
	FileChartColumnIncreasing,
	MoreHorizontal,
	PenLine,
	Receipt
} from "lucide-react"
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
	{ key: "ispEuTrafficLeft", label: "ISP Netherlands" },
	{ key: "residentialLiteTrafficLeft", label: "Res. Lite" },
	{ key: "mobileGbTrafficLeft", label: "Mobile GB" },
	{ key: "mobileTrafficLeft", label: "Premium Mobile" },
	{ key: "ipv6GbTrafficLeft", label: "IPv6" }
]

const hasTraffic = (value: unknown): boolean => {
	try {
		return BigInt(String(value || "0")) > BigInt(0)
	} catch {
		return Number(value || 0) > 0
	}
}

const UserActions: FC<{ user: AdminUser }> = ({ user }) => {
	const { open } = useModalStore()

	const handleAction = (action: string) => {
		if (action === "transactions")
			open(<TransactionsModal userId={user.id} />)
		if (action === "statistics") open(<Statistics userId={user.id} />)
	}

	return (
		<Select
			value=""
			onChange={handleAction}
			size="small"
			placeholder={<MoreHorizontal className="h-5 w-5" />}
			ariaLabel={`Действия с пользователем ${user.email}`}
			className="!w-10"
			buttonClassName="!h-10 !w-10 !justify-center !gap-0 !rounded-[10px] !border !border-white/10 !bg-white/[0.035] !p-0 hover:!border-[#4f8dff]/45 hover:!bg-[#4f8dff]/10 [&>svg:last-child]:hidden"
			menuClassName="!w-[190px]"
		>
			<Select.Option value="transactions">
				<Receipt className="h-4 w-4 text-[#6aa5ff]" />
				Транзакции
			</Select.Option>
			<Select.Option value="statistics">
				<FileChartColumnIncreasing className="h-4 w-4 text-[#6aa5ff]" />
				Статистика
			</Select.Option>
		</Select>
	)
}

const UsersTable: FC<UsersTableProps> = ({ users }) => {
	const { open } = useModalStore()

	return (
		<div className="w-full max-w-full min-w-0 overflow-x-auto rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] px-4 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
			<table className="w-full min-w-[1120px] table-fixed border-collapse text-left">
				<colgroup>
					<col className="w-[18%]" />
					<col className="w-[32%]" />
					<col className="w-[9%]" />
					<col className="w-[10%]" />
					<col className="w-[10%]" />
					<col className="w-[13%]" />
					<col className="w-[8%]" />
				</colgroup>
				<thead>
					<tr className="border-b border-white/[0.08] text-[11px] tracking-[0.06em] text-white/35 uppercase">
						<th className="px-3 py-3 font-medium whitespace-nowrap">
							Email
						</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">
							Трафик
						</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">
							Баланс
						</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">
							Моб. прокси
						</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">
							Авторизация
						</th>
						<th className="px-3 py-3 font-medium whitespace-nowrap">
							Дата регистрации
						</th>
						<th className="px-3 py-3 text-center font-medium whitespace-nowrap">
							Действия
						</th>
					</tr>
				</thead>
				<tbody className="text-[13px] text-white/75">
					{/* Порядок приходит с сервера (sortBy/sortDir) — клиентский sort ломал бы его. */}
					{users.map(el => {
						const activeTraffic = TRAFFIC_FIELDS.filter(field =>
							hasTraffic(el[field.key])
						)
						const trafficTitle = TRAFFIC_FIELDS.map(
							field =>
								`${field.label}: ${formatTraffic((el[field.key] as string) || "0")}`
						).join(" · ")

						return (
							<tr
								key={el.id}
								className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]"
							>
								<td className="px-3 py-3.5 font-medium break-all text-white/80">
									{el.email}
								</td>
								<td className="px-3 py-3">
									<div
										className="flex min-h-9 items-center gap-2"
										title={trafficTitle}
									>
										<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
											{activeTraffic.length ? (
												activeTraffic.map(field => (
													<span
														key={field.key}
														className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#4f8dff]/20 bg-[#4f8dff]/[0.08] px-2.5 whitespace-nowrap"
													>
														<span className="text-[11px] font-medium text-white/45">
															{field.label}
														</span>
														<span className="text-[12px] font-semibold text-white/85">
															{formatTraffic(
																(el[
																	field.key
																] as string) ||
																	"0"
															)}
														</span>
													</span>
												))
											) : (
												<span className="text-[13px] text-white/35">
													Нет активного трафика
												</span>
											)}
										</div>
										<button
											type="button"
											aria-label={`Изменить трафик ${el.email}`}
											className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-white/50 transition-colors hover:border-[#4f8dff]/40 hover:bg-[#4f8dff]/10 hover:text-[#8ab5ff] focus-visible:ring-2 focus-visible:ring-[#4f8dff] focus-visible:outline-none"
											onClick={() =>
												open(
													<ModifyUserTraffic
														user={el}
													/>
												)
											}
										>
											<PenLine className="h-3.5 w-3.5" />
										</button>
									</div>
								</td>
								<td className="px-3 py-3">
									<div className="flex flex-row items-center gap-2">
										<span className="text-body text-sm font-semibold">
											$
											{Number(el.balance || 0).toFixed(2)}
										</span>
										<button
											type="button"
											aria-label={`Изменить баланс ${el.email}`}
											className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.06] hover:text-[#8ab5ff] focus-visible:ring-2 focus-visible:ring-[#4f8dff] focus-visible:outline-none"
											onClick={() =>
												open(
													<ModifyUserBalance
														user={el}
													/>
												)
											}
										>
											<PenLine className="h-3.5 w-3.5" />
										</button>
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
								<td className="px-3 py-3 text-center">
									<div className="flex justify-center">
										<UserActions user={el} />
									</div>
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

export default UsersTable
