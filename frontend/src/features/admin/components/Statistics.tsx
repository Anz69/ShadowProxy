"use client"

import Link from "next/link"
import { type FC } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

import AdminStatsCharts from "@/features/admin/components/AdminStatsCharts"
import StatBlock from "@/features/admin/components/StatBlock"
import type { AdminChartsStats, AdminStats } from "@/features/admin/types/admin.types"

import Card from "@/shared/components/ui/Card"
import { formatTraffic } from "@/shared/utils/format-traffic"

type StatisticsProps = {
	stats: AdminStats
	chartsData?: AdminChartsStats | null
}

const Statistics: FC<StatisticsProps> = ({ stats, chartsData = null }) => {
	const monthlyVisits = chartsData?.monthlyVisits ?? null
	const visitsChartData = (monthlyVisits?.byDay ?? []).map(({ date, visits }) => ({ date, visits }))

	return (
		<div className="flex w-full flex-col gap-6">
			<h1 className="text-body text-5xl font-semibold">Статистика</h1>
			<nav className="border-body/25 bg-card/50 flex w-fit flex-row gap-2 rounded-xl border-2 p-1.5">
				<Link
					href="/admin/users"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Пользователи
				</Link>
				<Link
					href="/admin/stats"
					className="text-body bg-primary flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Статистика
				</Link>
				<Link
					href="/admin/logs"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Логи
				</Link>
				<Link
					href="/admin/settings"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Настройки
				</Link>
				<Link
					href="/admin/keys"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Ключи
				</Link>
				<Link
					href="/admin/servers"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Серверы
				</Link>
				<Link
					href="/admin/reviews"
					className="text-body flex w-60 cursor-pointer items-center justify-center rounded-md py-1 text-lg font-semibold"
				>
					Отзывы
				</Link>
			</nav>

			<div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
				<StatBlock
					stats={stats.replenish}
					label="Сумма пополнений"
					format={val => `${Number(val).toFixed(2)} $`}
				/>
				<StatBlock
					stats={stats.proxy}
					label="Создано прокси"
					format={val => `${val} шт.`}
				/>
				<StatBlock
					stats={stats.usageGb}
					label="Трафик"
					format={val => {
						if (val === 999) return "-"
						return formatTraffic(
							String(BigInt(Math.round(Number(val))) * BigInt(1024 ** 3))
						)
					}}
				/>
			</div>

			{/* Посещений за последние 30 прошедших дней (Cloudflare; по API доступно часто только до 8 дней) */}
			<Card>
				<h2 className="text-body mb-1 text-2xl font-semibold">Посещений сайта</h2>
				<p className="text-body/60 mb-4 text-sm">
					По данным Cloudflare за последние 30 прошедших дней (подневно). По лимитам API часто доступно не более 8 дней.
				</p>
				{monthlyVisits !== null ? (
					<>
						<div className="text-body mb-4 font-medium">
							Всего за период: <strong>{monthlyVisits.total.toLocaleString("ru-RU")}</strong>
						</div>
						<div className="h-64 w-full">
							{visitsChartData.length > 0 ? (
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={visitsChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
										<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
										<XAxis
											dataKey="date"
											stroke="rgba(255,255,255,0.5)"
											fontSize={12}
											tickFormatter={v => (v ? v.slice(0, 10) : v)}
										/>
										<YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
										<Tooltip
											contentStyle={{ backgroundColor: "#2a2d35", border: "1px solid rgba(255,255,255,0.2)" }}
											formatter={(value: number | undefined) => [value ?? 0, "Посещений"]}
											labelFormatter={label => `Дата: ${label}`}
										/>
										<Bar dataKey="visits" fill="#0067FF" name="Посещений" radius={[4, 4, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							) : (
								<div className="text-body/60 flex h-64 items-center justify-center text-sm">Нет данных за период</div>
							)}
						</div>
					</>
				) : (
					<div className="text-body/60 py-8 text-sm">Cloudflare API не настроен (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ANALYTICS_DOMAIN в .env). См. консоль бэкенда.</div>
				)}
			</Card>

			<AdminStatsCharts chartsData={chartsData} />
		</div>
	)
}

export default Statistics
