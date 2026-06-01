"use client"

import { type FC, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { AdminChartsStats } from "@/features/admin/types/admin.types"
import Card from "@/shared/components/ui/Card"

const PERIODS = [
	{ key: "day" as const, label: "Сутки" },
	{ key: "week" as const, label: "Неделя" },
	{ key: "month" as const, label: "Месяц" },
]

/** Типы трафика для выбора (без Mobile Time) */
const TRAFFIC_TYPE_OPTIONS: { key: "totalGb" | "premium" | "premiumResidential" | "mobileGb" | "ipv6"; label: string }[] = [
	{ key: "totalGb", label: "Общий" },
	{ key: "premium", label: "Residential Proxy" },
	{ key: "premiumResidential", label: "Premium Residential" },
	{ key: "mobileGb", label: "Mobile GB" },
	{ key: "ipv6", label: "IPv6" },
]

const ACTIVITY_PERIODS = [
	{ key: "hour" as const, label: "Час" },
	{ key: "day" as const, label: "День" },
	{ key: "week" as const, label: "Неделя" },
	{ key: "month" as const, label: "Месяц" },
]

/** Тип прокси для графика генераций (общий + по типам, включая Mobile Time) */
const PROXY_GEN_TYPE_OPTIONS: { key: "count" | "premium" | "premiumResidential" | "mobile" | "mobileGb" | "ipv6"; label: string }[] = [
	{ key: "count", label: "Общий" },
	{ key: "premium", label: "Residential Proxy" },
	{ key: "premiumResidential", label: "Premium Residential" },
	{ key: "mobile", label: "Mobile Time" },
	{ key: "mobileGb", label: "Mobile GB" },
	{ key: "ipv6", label: "IPv6" },
]

type AdminStatsChartsProps = {
	chartsData: AdminChartsStats | null
}

const AdminStatsCharts: FC<AdminStatsChartsProps> = ({ chartsData }) => {
	const [revenuePeriod, setRevenuePeriod] = useState<"day" | "week" | "month">("week")
	const [newUsersPeriod, setNewUsersPeriod] = useState<"day" | "week" | "month">("week")
	const [trafficType, setTrafficType] = useState<"totalGb" | "premium" | "premiumResidential" | "mobileGb" | "ipv6">("totalGb")
	const [trafficPeriod, setTrafficPeriod] = useState<"day" | "week" | "month">("day")
	const [activeUsersPeriod, setActiveUsersPeriod] = useState<"hour" | "day" | "week" | "month">("week")
	const [proxyGenPeriod, setProxyGenPeriod] = useState<"hour" | "day" | "week" | "month">("week")
	const [proxyGenType, setProxyGenType] = useState<"count" | "premium" | "premiumResidential" | "mobile" | "mobileGb" | "ipv6">("count")

	const revenuePoints =
		chartsData?.revenue?.[revenuePeriod === "day" ? "byDay" : revenuePeriod === "week" ? "byWeek" : "byMonth"] ?? []
	const revenueTotals =
		chartsData?.revenue?.[revenuePeriod === "day" ? "totalDay" : revenuePeriod === "week" ? "totalWeek" : "totalMonth"] ?? {
			sum: 0,
			count: 0,
		}
	const newUsersPoints =
		chartsData?.newUsers?.[newUsersPeriod === "day" ? "byDay" : newUsersPeriod === "week" ? "byWeek" : "byMonth"] ?? []
	const trafficByDay = chartsData?.trafficByDay ?? []
	const trafficByWeek = chartsData?.trafficByWeek ?? []
	const trafficByMonth = chartsData?.trafficByMonth ?? []
	const trafficPoints = trafficPeriod === "day" ? trafficByDay : trafficPeriod === "week" ? trafficByWeek : trafficByMonth
	const activityData = chartsData?.activity
	const activeUsersPeriodKey = activeUsersPeriod === "hour" ? "byHour" : activeUsersPeriod === "day" ? "byDay" : activeUsersPeriod === "week" ? "byWeek" : "byMonth"
	const activeUsersPoints = (activityData?.activeUsers[activeUsersPeriodKey] ?? []).map((p) => ({ date: p.date, count: p.count }))
	const proxyGenPeriodKey = proxyGenPeriod === "hour" ? "byHour" : proxyGenPeriod === "day" ? "byDay" : proxyGenPeriod === "week" ? "byWeek" : "byMonth"
	const proxyGenPoints = activityData?.proxyGenerations[proxyGenPeriodKey] ?? []
	const proxyGenDataKey = proxyGenType

	return (
		<div className="flex w-full flex-col gap-8">
			{/* 1) Оборот */}
			<Card>
				<h2 className="text-body mb-4 text-2xl font-semibold">Оборот</h2>
				<div className="mb-2 flex gap-2">
					{PERIODS.map((p) => (
						<button
							key={p.key}
							type="button"
							onClick={() => setRevenuePeriod(p.key)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
								revenuePeriod === p.key ? "bg-primary text-white" : "bg-card text-body hover:bg-white/10"
							}`}
						>
							{p.label}
						</button>
					))}
				</div>
				<div className="mb-4 flex flex-wrap gap-4 text-body">
					<span className="font-medium">
						Общая сумма за период: <strong>{revenueTotals.sum.toFixed(2)} $</strong>
					</span>
					<span className="font-medium">
						Количество покупок: <strong>{revenueTotals.count}</strong>
					</span>
				</div>
				<div className="h-64 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={revenuePoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
							<XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => v.slice(0, 7)} />
							<YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => `${v}$`} />
							<Tooltip
								contentStyle={{ backgroundColor: "#2a2d35", border: "1px solid rgba(255,255,255,0.2)" }}
								formatter={(value: number | undefined) => [`${Number(value ?? 0).toFixed(2)} $`, "Сумма"]}
								labelFormatter={(label) => `Дата: ${label}`}
							/>
							<Bar dataKey="sum" fill="#0067FF" name="Сумма" radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</Card>

			{/* 2) Новые пользователи */}
			<Card>
				<h2 className="text-body mb-4 text-2xl font-semibold">Новые пользователи</h2>
				<div className="mb-2 flex gap-2">
					{PERIODS.map((p) => (
						<button
							key={p.key}
							type="button"
							onClick={() => setNewUsersPeriod(p.key)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
								newUsersPeriod === p.key ? "bg-primary text-white" : "bg-card text-body hover:bg-white/10"
							}`}
						>
							{p.label}
						</button>
					))}
				</div>
				<div className="h-64 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={newUsersPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
							<XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => v.slice(0, 7)} />
							<YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
							<Tooltip
								contentStyle={{ backgroundColor: "#2a2d35", border: "1px solid rgba(255,255,255,0.2)" }}
								formatter={(value: number | undefined) => [value ?? 0, "Регистраций"]}
								labelFormatter={(label) => `Дата: ${label}`}
							/>
							<Bar dataKey="count" fill="#82ca9d" name="Регистраций" radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</Card>

			{/* 3) Расход трафика: период (Сутки / Неделя / Месяц) + тип (общий или по типам) */}
			<Card>
				<h2 className="text-body mb-4 text-2xl font-semibold">Расход трафика</h2>
				<p className="text-body/60 mb-2 text-sm">Период и тип: общий расход или по типу прокси</p>
				<div className="mb-2 flex flex-wrap gap-2">
					<span className="text-body/60 self-center text-sm">Период:</span>
					{(["day", "week", "month"] as const).map((key) => (
						<button
							key={key}
							type="button"
							onClick={() => setTrafficPeriod(key)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
								trafficPeriod === key ? "bg-primary text-white" : "bg-card text-body hover:bg-white/10"
							}`}
						>
							{key === "day" ? "Сутки" : key === "week" ? "Неделя" : "Месяц"}
						</button>
					))}
				</div>
				<div className="mb-2 flex flex-wrap gap-2">
					<span className="text-body/60 self-center text-sm">Тип:</span>
					{TRAFFIC_TYPE_OPTIONS.map((opt) => (
						<button
							key={opt.key}
							type="button"
							onClick={() => setTrafficType(opt.key)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
								trafficType === opt.key ? "bg-primary text-white" : "bg-card text-body hover:bg-white/10"
							}`}
						>
							{opt.label}
						</button>
					))}
				</div>
				<div className="h-64 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={trafficPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
							<XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => (v?.length > 10 ? v.slice(-7) : v?.slice?.(-5) ?? v)} />
							<YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => `${v} Гб`} />
							<Tooltip
								contentStyle={{ backgroundColor: "#2a2d35", border: "1px solid rgba(255,255,255,0.2)" }}
								formatter={(value: number | undefined) => [Number(value ?? 0).toFixed(2), "ГБ"]}
								labelFormatter={(label) => `Период: ${label}`}
							/>
							<Bar dataKey={trafficType} fill="#0067FF" name="Трафик (ГБ)" radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</Card>

			{/* Активные пользователи */}
			<Card>
				<h2 className="text-body mb-4 text-2xl font-semibold">Активные пользователи</h2>
				<p className="text-body/60 mb-2 text-sm">Уникальные пользователи, совершившие хотя бы одно действие за период.</p>
				<div className="mb-2 flex gap-2">
					{ACTIVITY_PERIODS.map((p) => (
						<button
							key={p.key}
							type="button"
							onClick={() => setActiveUsersPeriod(p.key)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
								activeUsersPeriod === p.key ? "bg-primary text-white" : "bg-card text-body hover:bg-white/10"
							}`}
						>
							{p.label}
						</button>
					))}
				</div>
				<div className="h-64 w-full">
					{activeUsersPoints.length > 0 ? (
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={activeUsersPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
								<XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => (v?.length > 10 ? v.slice(-8) : v)} />
								<YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
								<Tooltip
									contentStyle={{ backgroundColor: "#2a2d35", border: "1px solid rgba(255,255,255,0.2)" }}
									formatter={(value: number | undefined) => [value ?? 0, "Пользователей"]}
									labelFormatter={(label) => `Период: ${label}`}
								/>
								<Bar dataKey="count" fill="#0067FF" name="Активные пользователи" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className="text-body/60 flex h-64 items-center justify-center text-sm">Нет данных за выбранный период</div>
					)}
				</div>
			</Card>

			{/* Генерации прокси: по умолчанию общий, подвыбор типа (включая Mobile Time) */}
			<Card>
				<h2 className="text-body mb-4 text-2xl font-semibold">Генерации прокси</h2>
				<p className="text-body/60 mb-2 text-sm">Созданные прокси (через прокси-сервер и провайдера). Можно отфильтровать по типу.</p>
				<div className="mb-2 flex flex-wrap gap-2">
					{PROXY_GEN_TYPE_OPTIONS.map((opt) => (
						<button
							key={opt.key}
							type="button"
							onClick={() => setProxyGenType(opt.key)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
								proxyGenType === opt.key ? "bg-primary text-white" : "bg-card text-body hover:bg-white/10"
							}`}
						>
							{opt.label}
						</button>
					))}
				</div>
				<div className="mb-2 flex gap-2">
					{ACTIVITY_PERIODS.map((p) => (
						<button
							key={p.key}
							type="button"
							onClick={() => setProxyGenPeriod(p.key)}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
								proxyGenPeriod === p.key ? "bg-primary text-white" : "bg-card text-body hover:bg-white/10"
							}`}
						>
							{p.label}
						</button>
					))}
				</div>
				<div className="h-64 w-full">
					{proxyGenPoints.length > 0 ? (
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={proxyGenPoints} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
								<XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(v) => (v?.length > 10 ? v.slice(-8) : v)} />
								<YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
								<Tooltip
									contentStyle={{ backgroundColor: "#2a2d35", border: "1px solid rgba(255,255,255,0.2)" }}
									formatter={(value: number | undefined) => [value ?? 0, "Генераций"]}
									labelFormatter={(label) => `Период: ${label}`}
								/>
								<Bar dataKey={proxyGenDataKey} fill="#82ca9d" name="Генерации" radius={[4, 4, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					) : (
						<div className="text-body/60 flex h-64 items-center justify-center text-sm">Нет данных за выбранный период</div>
					)}
				</div>
			</Card>
		</div>
	)
}

export default AdminStatsCharts
