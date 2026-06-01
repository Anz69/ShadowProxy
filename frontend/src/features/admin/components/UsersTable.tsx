"use client"

import { FileChartColumnIncreasing, Pen, Receipt, Wallet } from "lucide-react"
import type { FC } from "react"

import ModifyUserBalance from "@/features/admin/components/modals/ModifyUserBalance"
import ModifyUserTraffic from "@/features/admin/components/modals/ModifyUserTraffic"
import Statistics from "@/features/admin/components/modals/Statistics"
import TransactionsModal from "@/features/admin/components/modals/TransactionsModal"
import type { AdminUser } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { formatDate } from "@/shared/utils/format-date"
import { formatTraffic } from "@/shared/utils/format-traffic"
import { sortByCreatedAtDesc } from "@/shared/utils/sort-by-created-at-desc"

type UsersTableProps = {
	users: AdminUser[]
}

const UsersTable: FC<UsersTableProps> = ({ users }) => {
	const { open } = useModalStore()

	return (
		<div className="bg-card/25 w-full min-w-0 max-w-full overflow-x-auto rounded-xl p-4">
			<table className="text-body w-full border-collapse overflow-hidden rounded-xl text-left">
				<thead className="bg-card/50 text-sm">
					<tr>
						<th className="px-3 py-3 whitespace-nowrap">Email</th>
						<th className="px-3 py-3 whitespace-nowrap">Трафик</th>
						<th className="px-3 py-3 whitespace-nowrap">Баланс</th>
						<th className="px-3 py-3 whitespace-nowrap">Моб. прокси</th>
						<th className="px-3 py-3 whitespace-nowrap">Авторизация</th>
						<th className="px-3 py-3 whitespace-nowrap">Дата регистрации</th>
						<th className="px-3 py-3 whitespace-nowrap">Управление</th>
					</tr>
				</thead>
				<tbody className="text-sm font-medium">
					{users.sort(sortByCreatedAtDesc).map((el, i) => (
						<tr
							key={i}
							className={
								i % 2 === 0 ? "bg-transparent" : "bg-card/50"
							}
						>
							<td className="px-3 py-3 whitespace-nowrap">{el.email}</td>
							<td className="px-3 py-3">
								<div className="flex h-9 flex-row items-center gap-2">
									<div className="flex flex-col items-center text-center">
										<span className="text-body text-sm leading-4 font-semibold">
											{formatTraffic(
												el.premiumTrafficLeft
											)}
										</span>
										<span className="text-body/50 text-[11px] font-medium">
											Premium
										</span>
									</div>
									<div
										className="bg-body/25 h-9 shrink-0 self-stretch rounded-sm"
										style={{
											width: 1
										}}
									/>
									<div className="flex flex-col items-center text-center">
										<span className="text-body text-sm leading-4 font-semibold whitespace-nowrap">
											{formatTraffic(
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												(el as any).premiumResidentialTrafficLeft || "0"
											)}
										</span>
										<span className="text-body/50 text-[11px] font-medium whitespace-nowrap">
											Prem.Res
										</span>
									</div>
									<div
										className="bg-body/25 h-9 shrink-0 self-stretch rounded-sm"
										style={{
											width: 1
										}}
									/>
									<div className="flex flex-col items-center text-center">
										<span className="text-body text-sm leading-4 font-semibold whitespace-nowrap">
											{formatTraffic(
												el.mobileGbTrafficLeft || "0"
											)}
										</span>
										<span className="text-body/50 text-[11px] font-medium whitespace-nowrap">
											Mobile GB
										</span>
									</div>
									<div
										className="bg-body/25 h-9 shrink-0 self-stretch rounded-sm"
										style={{
											width: 1
										}}
									/>
									<div className="flex flex-col items-center text-center">
										<span className="text-body text-sm leading-4 font-semibold whitespace-nowrap">
											{formatTraffic(
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												(el as any).mobileTrafficLeft || "0"
											)}
										</span>
										<span className="text-[11px] font-medium whitespace-nowrap text-body/50">
											Mobile
										</span>
									</div>
									<div
										className="bg-body/25 h-9 shrink-0 self-stretch rounded-sm"
										style={{
											width: 1
										}}
									/>
									<div className="flex flex-col items-center text-center">
										<span className="text-body text-sm leading-4 font-semibold whitespace-nowrap">
											{formatTraffic(
												el.ipv6GbTrafficLeft || "0"
											)}
										</span>
										<span className="text-body/50 text-[11px] font-medium whitespace-nowrap">
											IPv6
										</span>
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
							{el.proxies.filter(el => el.type === "MOBILE")
								.length ? (
								<span></span>
							) : (
								"Нет активных"
							)}
						</td>
							<td className="px-3 py-3">
								{el.authMethod === "CREDENTIALS"
									? "Email + пароль"
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
												<TransactionsModal
													transactions={el.payments}
												/>
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
												<Statistics stats={el.stats} />
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
