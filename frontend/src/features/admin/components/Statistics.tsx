"use client"

import { type FC } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

import AdminNav from "@/features/admin/components/AdminNav"
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
		<div className="relative z-[1] flex w-full flex-col gap-6">
			<div>
				<p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6aa5ff]">Аналитика платформы</p>
				<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">Статистика</h1>
				<p className="mt-2 max-w-2xl text-sm text-white/50">Оборот, пользователи, генерации и расход трафика в одном экране.</p>
			</div>
			<AdminNav active="/admin/stats" />

			{/* Всего зарегистрированных пользователей (ТЗ 3.4) */}
			<Card className="relative overflow-hidden !border-[#3c78ff]/25 !bg-gradient-to-br !from-[#102148] !to-[#0b1429] !py-5">
				<div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#0067ff]/20 blur-3xl" />
				<div className="relative flex items-center justify-between gap-4">
				<span className="text-[15px] font-medium text-white/60">Всего зарегистрированных пользователей</span>
				<span className="font-[TalosDisplay] text-3xl font-bold text-white md:text-4xl">
					{stats.usersTotal ?? "—"}
				</span>
				</div>
			</Card>

			<div className="grid w-full grid-cols-1 gap-5 xl:grid-cols-3">
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
				<h2 className="mb-1 font-[TalosDisplay] text-2xl font-semibold text-white">Посещений сайта</h2>
				<p className="mb-4 text-sm text-white/60">
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
											contentStyle={{ backgroundColor: "#0e1830", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff" }}
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
