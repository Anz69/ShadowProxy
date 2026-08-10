"use client"

import { ChevronRight, ChevronLeft, TrendingUp } from "lucide-react"
import { type FC, useState, useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t, type SupportedLocale } from "@/shared/utils/i18n"
import { packageService } from "@/features/packages/services/package.service"
import { formatTraffic } from "@/shared/utils/format-traffic"
import { formatDateRangeSmart } from "@/shared/utils/format-date-range"

type TrafficData = {
	day: string
	date: string
	value: bigint | null
	isToday?: boolean
}

// Catmull-Rom → cubic bezier: gives a smooth, organic curve through all points.
const buildSmoothPath = (pts: { x: number; y: number }[]): string => {
	if (pts.length === 0) return ""
	if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
	const d = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`]
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[i - 1] || pts[i]
		const p1 = pts[i]
		const p2 = pts[i + 1]
		const p3 = pts[i + 2] || p2
		const cp1x = p1.x + (p2.x - p0.x) / 6
		const cp1y = p1.y + (p2.y - p0.y) / 6
		const cp2x = p2.x - (p3.x - p1.x) / 6
		const cp2y = p2.y - (p3.y - p1.y) / 6
		d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`)
	}
	return d.join(" ")
}

type TrafficChartProps = {
	packageId?: string
}

type TrafficStatsItem = {
	date: string
	hour?: number
	inBytes: string
	outBytes: string
	totalBytes: string
}

const TrafficChart: FC<TrafficChartProps> = ({ packageId }) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname) as SupportedLocale
	const T = (key: string, params?: Record<string, string>) => t(key, locale, params)
	
	const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
		const now = new Date()
		const day = now.getDay()
		const diff = now.getDate() - day + (day === 0 ? -6 : 1)
		const monday = new Date(now.setDate(diff))
		monday.setHours(0, 0, 0, 0)
		return monday
	})
	const [stats, setStats] = useState<TrafficStatsItem[]>([])
	const [bounds, setBounds] = useState<{ firstDate: string | null; lastDate: string | null } | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [hovered, setHovered] = useState<number | null>(null)

	// Получаем границы данных
	useEffect(() => {
		if (!packageId) return
		const fetchBounds = async () => {
			try {
				const data = await packageService.getTrafficBounds(packageId)
				setBounds(data)
				// Если логов еще нет, сбрасываем на текущую неделю
				if (!data.firstDate || !data.lastDate) {
					const now = new Date()
					const day = now.getDay()
					const diff = now.getDate() - day + (day === 0 ? -6 : 1)
					const monday = new Date(now.setDate(diff))
					monday.setHours(0, 0, 0, 0)
					setCurrentWeekStart(monday)
				}
			} catch (error) {
				console.error("Ошибка при получении границ трафика:", error)
				// Если ошибка, тоже сбрасываем на текущую неделю
				const now = new Date()
				const day = now.getDay()
				const diff = now.getDate() - day + (day === 0 ? -6 : 1)
				const monday = new Date(now.setDate(diff))
				monday.setHours(0, 0, 0, 0)
				setCurrentWeekStart(monday)
			}
		}
		fetchBounds()
	}, [packageId])

	// Получаем статистику
	useEffect(() => {
		if (!packageId) return
		const fetchStats = async () => {
			setIsLoading(true)
			try {
				const startDate = currentWeekStart
				const endDate = new Date(startDate)
				endDate.setDate(startDate.getDate() + 6)
				endDate.setHours(23, 59, 59, 999)

				const data = await packageService.getTrafficStats(
					packageId,
					startDate.toISOString(),
					endDate.toISOString(),
					"day"
				)
				setStats(data)
			} catch (error) {
				console.error("Ошибка при получении статистики трафика:", error)
				setStats([])
			} finally {
				setIsLoading(false)
			}
		}
		fetchStats()
	}, [packageId, currentWeekStart])

	// Обновление статистики раз в минуту
	useEffect(() => {
		if (!packageId) return
		const interval = setInterval(() => {
			const fetchStats = async () => {
				try {
					const startDate = currentWeekStart
					const endDate = new Date(startDate)
					endDate.setDate(startDate.getDate() + 6)
					endDate.setHours(23, 59, 59, 999)

					const data = await packageService.getTrafficStats(
						packageId,
						startDate.toISOString(),
						endDate.toISOString(),
						"day"
					)
					setStats(data)
				} catch (error) {
					console.error("Ошибка при обновлении статистики трафика:", error)
				}
			}
			fetchStats()
		}, 60000)

		return () => clearInterval(interval)
	}, [packageId, currentWeekStart])

	// Формируем данные для недели
	const weekData = useMemo(() => {
		if (!packageId) return []

		const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
		const today = new Date()
		today.setHours(0, 0, 0, 0)

		return days.map((dayName, index) => {
			const date = new Date(currentWeekStart)
			date.setDate(currentWeekStart.getDate() + index)

			const dayStats = stats.find(s => {
				const statDate = new Date(s.date)
				statDate.setHours(0, 0, 0, 0)
				return statDate.getTime() === date.getTime()
			})

			const totalBytes = dayStats ? BigInt(dayStats.totalBytes) : null
			const isToday = date.getTime() === today.getTime()

			return {
				day: dayName,
				date: date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
				value: totalBytes,
				isToday
			}
		})
	}, [currentWeekStart, stats, packageId])

	// Среднее значение за день
	const averagePerDay = useMemo(() => {
		if (!packageId || stats.length === 0) return BigInt(0)
		const totalTraffic = stats.reduce((sum, item) => sum + BigInt(item.totalBytes), BigInt(0))
		return totalTraffic / BigInt(7)
	}, [stats, packageId])

	// Форматируем диапазон дат (без повторов месяца/года)
	const dateRange = useMemo(() => {
		const startDate = currentWeekStart
		const endDate = new Date(startDate)
		endDate.setDate(startDate.getDate() + 6)

		const { start, end } = formatDateRangeSmart(startDate, endDate, locale, (key, params) =>
			t(key, locale, params)
		)
		return `${start} — ${end}`
	}, [currentWeekStart, locale])

	// Проверка возможности переключения вперед
	const canGoForward = useMemo(() => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const weekEnd = new Date(currentWeekStart)
		weekEnd.setDate(currentWeekStart.getDate() + 6)
		return weekEnd < today
	}, [currentWeekStart])

	// Проверка возможности переключения назад
	const canGoBack = useMemo(() => {
		if (!bounds?.firstDate || !packageId) return false
		
		const firstDate = new Date(bounds.firstDate)
		firstDate.setHours(0, 0, 0, 0)
		const day = firstDate.getDay()
		const firstWeekStart = new Date(firstDate)
		firstWeekStart.setDate(firstDate.getDate() - day + (day === 0 ? -6 : 1))
		firstWeekStart.setHours(0, 0, 0, 0)
		
		return currentWeekStart.getTime() > firstWeekStart.getTime()
	}, [currentWeekStart, bounds, packageId])

	const handlePrev = () => {
		const prevWeek = new Date(currentWeekStart)
		prevWeek.setDate(currentWeekStart.getDate() - 7)
		prevWeek.setHours(0, 0, 0, 0)
		setCurrentWeekStart(prevWeek)
	}

	const handleNext = () => {
		const nextWeek = new Date(currentWeekStart)
		nextWeek.setDate(currentWeekStart.getDate() + 7)
		nextWeek.setHours(0, 0, 0, 0)
		setCurrentWeekStart(nextWeek)
	}

	// Данные для отображения
	const trafficData: TrafficData[] = packageId 
		? weekData
		: [
			{ day: T("package.trafficChart.days.mon"), date: "15.12", value: null },
			{ day: T("package.trafficChart.days.tue"), date: "16.12", value: null },
			{ day: T("package.trafficChart.days.wed"), date: "17.12", value: null },
			{ day: T("package.trafficChart.days.thu"), date: "18.12", value: null },
			{ day: T("package.trafficChart.days.fri"), date: "19.12", value: null },
			{ day: T("package.trafficChart.days.sat"), date: "20.12", value: null },
			{ day: T("package.trafficChart.days.sun"), date: "21.12", value: null }
		]

	// Среднее значение (для статического режима)
	const averageValue = packageId && stats.length > 0
		? Number(averagePerDay) / (1024 ** 3)
		: 2.0

	// Форматированное значение для блока статистики. Реальный пакет — авто-единицы
	// (MB/GB/TB); иначе десятки МБ показывались как «0,0 Gb». Демо — статичные 2,0 GB.
	const averageDisplayValue = packageId
		? formatTraffic(averagePerDay.toString())
		: `${averageValue.toFixed(1).replace(".", ",")} ${T("package.trafficChart.gb")}`

	// Геометрия графика в нормализованном пространстве 0..100 (рисуем в SVG с
	// preserveAspectRatio="none" + non-scaling-stroke, точки — HTML-оверлеем).
	const chart = useMemo(() => {
		const n = trafficData.length
		const gbVals = trafficData.map(d => (d.value !== null ? Number(d.value) / (1024 ** 3) : 0))
		const maxGb = Math.max(0, ...gbVals)
		// «Есть данные» — если есть хоть сколько-то заметный трафик (≥ ~1 МБ). Ниже —
		// показываем декоративную волну + «нет данных» (чтобы блок не выглядел пустым).
		const hasData = maxGb >= 0.001
		// Динамический масштаб под реальный максимум (+30% воздуха сверху), а НЕ фикс-пол
		// в 0.5 ГБ — иначе МБ-трафик сплющивался в почти-плоскую линию с волной-артефактом.
		// Так кривая заполняет высоту и отражает реальные пропорции по дням.
		const scaleMax = hasData ? maxGb * 1.3 : 1
		const top = 16, bottom = 14, xPad = 7
		// Когда данных нет — рисуем декоративную «призрачную» волну, чтобы блок
		// выглядел задуманным, а не пустым. Узор фиксированный (не данные).
		const ghostNorm = [0.34, 0.52, 0.4, 0.66, 0.46, 0.74, 0.58]
		const pts = trafficData.map((d, i) => {
			const x = n <= 1 ? 50 : xPad + (i / (n - 1)) * (100 - xPad * 2)
			const norm = hasData ? gbVals[i] / scaleMax : (ghostNorm[i % ghostNorm.length] ?? 0.4)
			const y = (100 - bottom) - norm * (100 - bottom - top)
			return { x, y, gb: gbVals[i], raw: d }
		})
		const line = buildSmoothPath(pts)
		const area = pts.length > 1
			? `${line} L ${pts[pts.length - 1].x.toFixed(2)} 100 L ${pts[0].x.toFixed(2)} 100 Z`
			: ""
		return { pts, maxGb, line, area, hasData }
	}, [trafficData])

	const fmtPoint = (p: { gb: number; raw: TrafficData }) => {
		if (p.raw.value === null) return "—"
		if (packageId) return formatTraffic(p.raw.value.toString())
		return `${p.gb.toFixed(1).replace(".", ",")} ${T("package.trafficChart.gb")}`
	}

	const rangeLabel = packageId ? dateRange : "15 — 21.12.2025"
	const emptyLabel = locale === "ru" ? "Пока нет данных за эту неделю" : locale === "zh-CN" ? "本周暂无数据" : "No data yet for this week"
	const avgLabel = locale === "ru" ? "В среднем за неделю" : locale === "zh-CN" ? "每周平均" : "Avg / week"

	return (
		<div className="traffic-chart-mobile relative flex w-full flex-col gap-6 rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-6 sm:p-7 shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] light:border-[#e6e8ef] light:bg-none light:bg-white light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.14)]">
			<style>{`
				.tc-line { stroke-dasharray: 100; stroke-dashoffset: 100; animation: tc-draw 1.4s cubic-bezier(.16,1,.3,1) forwards; }
				@keyframes tc-draw { to { stroke-dashoffset: 0; } }
				.tc-area { opacity: 0; animation: tc-fade 1.1s ease-out .25s forwards; }
				@keyframes tc-fade { to { opacity: 1; } }
				.tc-dot { opacity: 0; animation: tc-pop .4s ease-out forwards; }
				@keyframes tc-pop { from { opacity: 0; transform: translate(-50%,-50%) scale(.4); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
				@media (prefers-reduced-motion: reduce) {
					.tc-line { animation: none; stroke-dashoffset: 0; }
					.tc-area, .tc-dot { animation: none; opacity: 1; }
				}
			`}</style>

			{/* Header: title + average stat */}
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex flex-col gap-1.5">
					<h2 className="font-[TalosDisplay] text-[clamp(20px,2.4vw,26px)] font-semibold leading-none text-white light:text-[#0e1019]">
						{T("package.trafficChart.title")}{" "}
						<span className="text-white/30 light:text-[#9aa3b2]">{T("package.trafficChart.gb")}</span>
					</h2>
					<span className="text-[13px] text-white/45 light:text-[#8a93a3]">{rangeLabel}</span>
				</div>

				<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-2.5 light:border-[#e2e4ea] light:bg-[#f4f6fa]">
					<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-[#6aa5ff]/25 to-[#2f6bff]/10 text-[#6aa5ff] light:from-[#2f6bff]/12 light:to-[#2f6bff]/[0.04] light:text-[#2f6bff]">
						<TrendingUp className="h-[18px] w-[18px]" />
					</span>
					<div className="flex flex-col">
						<span className="text-[11px] font-medium uppercase tracking-wide text-white/40 light:text-[#8a93a3]">
							{avgLabel}
						</span>
						<span className="font-[TalosDisplay] text-[22px] font-bold leading-none text-white light:text-[#0e1019]">
							{averageDisplayValue}
						</span>
					</div>
				</div>
			</div>

			{/* Chart */}
			<div className="relative w-full flex-1" style={{ minHeight: "230px" }}>
				<svg
					key={rangeLabel}
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
					className="absolute inset-0 h-full w-full overflow-visible text-white/[0.07] light:text-[#0e1019]/[0.06]"
					aria-hidden
				>
					<defs>
						<linearGradient id="tcFill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#5b97ff" stopOpacity="0.34" />
							<stop offset="20%" stopColor="#5390ff" stopOpacity="0.18" />
							<stop offset="40%" stopColor="#4f8dff" stopOpacity="0.07" />
							<stop offset="58%" stopColor="#2f6bff" stopOpacity="0" />
						</linearGradient>
						<linearGradient id="tcLine" x1="0" y1="0" x2="1" y2="0">
							<stop offset="0%" stopColor="#6aa5ff" />
							<stop offset="100%" stopColor="#2f6bff" />
						</linearGradient>
						{/* мягкое затухание заливки по краям — чтобы график не обрывался резко */}
						<linearGradient id="tcMaskX" x1="0" y1="0" x2="1" y2="0">
							<stop offset="0%" stopColor="#000" />
							<stop offset="11%" stopColor="#fff" />
							<stop offset="89%" stopColor="#fff" />
							<stop offset="100%" stopColor="#000" />
						</linearGradient>
						<mask id="tcAreaMask">
							<rect x="0" y="0" width="100" height="100" fill="url(#tcMaskX)" />
						</mask>
					</defs>
					{/* horizontal grid */}
					{[16, 37, 58, 79].map(gy => (
						<line key={gy} x1="0" y1={gy} x2="100" y2={gy} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 5" />
					))}
					<path className="tc-area" d={chart.area} fill="url(#tcFill)" mask="url(#tcAreaMask)" opacity={chart.hasData ? 1 : 0.6} />
					<path
						className={chart.hasData ? "tc-line" : ""}
						d={chart.line}
						fill="none"
						stroke="url(#tcLine)"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
						pathLength={100}
						opacity={chart.hasData ? 1 : 0.55}
						style={{ filter: "drop-shadow(0 10px 18px rgba(79,141,255,0.28))" }}
					/>
				</svg>

				{/* dots + hover columns + tooltip overlay */}
				<div className="absolute inset-0" onMouseLeave={() => setHovered(null)}>
					{chart.pts.map((p, i) => {
						const isHovered = hovered === i
						const isToday = !!p.raw.isToday
						const active = isHovered || isToday
						return (
							<span
								key={i}
								className={`tc-dot pointer-events-none absolute z-[2] block rounded-full transition-all duration-150 ${
									active
										? "h-3 w-3 bg-[#6aa5ff] shadow-[0_0_0_4px_rgba(106,165,255,0.22),0_0_18px_-2px_rgba(106,165,255,0.9)] ring-2 ring-white/70 light:ring-white"
										: chart.hasData
											? "h-2.5 w-2.5 bg-[#4f8dff] shadow-[0_0_0_3px_rgba(79,141,255,0.16)]"
											: "h-2 w-2 bg-[#7ea8ff]/70 light:bg-[#aebbd6]"
								}`}
								style={{
									left: `${p.x}%`,
									top: `${p.y}%`,
									animationDelay: `${0.4 + i * 0.07}s`
								}}
							/>
						)
					})}

					{/* vertical guide + tooltip */}
					{chart.hasData && hovered !== null && chart.pts[hovered] && (
						<>
							<span
								className="pointer-events-none absolute top-0 bottom-0 z-[1] w-px bg-gradient-to-b from-transparent via-[#6aa5ff]/40 to-transparent light:via-[#2f6bff]/30"
								style={{ left: `${chart.pts[hovered].x}%` }}
							/>
							<div
								className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-[calc(100%+16px)] whitespace-nowrap rounded-xl border border-white/12 bg-[#0b1224]/95 px-3 py-2 text-center shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md light:border-[#e2e4ea] light:bg-white/95 light:shadow-[0_16px_40px_-16px_rgba(14,16,25,0.25)]"
								style={{ left: `${chart.pts[hovered].x}%`, top: `${chart.pts[hovered].y}%` }}
							>
								<div className="font-[TalosDisplay] text-[15px] font-bold leading-none text-white light:text-[#0e1019]">
									{fmtPoint(chart.pts[hovered])}
								</div>
								<div className="mt-1 text-[11px] text-white/50 light:text-[#8a93a3]">
									{chart.pts[hovered].raw.day} · {chart.pts[hovered].raw.date}
								</div>
							</div>
						</>
					)}

					{/* hover hit-columns (only when there's real data to show) */}
					{chart.hasData && (
						<div className="absolute inset-0 z-[2] flex">
							{chart.pts.map((_, i) => (
								<button
									key={i}
									type="button"
									aria-label={`day-${i}`}
									className="h-full flex-1 cursor-default"
									onMouseEnter={() => setHovered(i)}
									onFocus={() => setHovered(i)}
								/>
							))}
						</div>
					)}

					{!chart.hasData && (
						<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
							<span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[13px] text-white/45 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#8a93a3]">
								{emptyLabel}
							</span>
						</div>
					)}
				</div>
			</div>

			{/* x-axis labels (aligned to points) */}
			<div className="relative h-10">
				{chart.pts.map((p, i) => (
					<div
						key={i}
						className="absolute flex -translate-x-1/2 flex-col items-center gap-0.5"
						style={{ left: `${p.x}%` }}
					>
						<span className={`text-[13px] font-medium ${p.raw.isToday ? "text-[#6aa5ff] light:text-[#2f6bff]" : "text-white/70 light:text-[#475467]"}`}>
							{p.raw.day}
						</span>
						<span className={`text-[11px] tabular-nums ${p.raw.isToday ? "text-[#6aa5ff]/70 light:text-[#2f6bff]/70" : "text-white/30 light:text-[#9aa3b2]"}`}>
							{p.raw.date}
						</span>
					</div>
				))}
			</div>

			{/* Week navigation */}
			<div className="flex items-center justify-between gap-3">
				<button
					onClick={handlePrev}
					disabled={!canGoBack}
					aria-label="prev week"
					className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
						canGoBack
							? "border-white/15 bg-white/[0.05] text-white hover:bg-white/10 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#0e1019] light:hover:bg-[#eef1f6]"
							: "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-white/40 opacity-40 light:border-[#eef0f4] light:bg-[#f8f9fc] light:text-[#9aa3b2]"
					}`}
				>
					<ChevronLeft className="h-5 w-5" />
				</button>
				<span className="font-[TalosDisplay] text-[15px] font-semibold tracking-[-0.01em] text-white/85 light:text-[#0e1019]">
					{rangeLabel}
				</span>
				<button
					onClick={handleNext}
					disabled={!canGoForward}
					aria-label="next week"
					className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
						canGoForward
							? "border-white/15 bg-white/[0.05] text-white hover:bg-white/10 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#0e1019] light:hover:bg-[#eef1f6]"
							: "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-white/40 opacity-40 light:border-[#eef0f4] light:bg-[#f8f9fc] light:text-[#9aa3b2]"
					}`}
				>
					<ChevronRight className="h-5 w-5" />
				</button>
			</div>
		</div>
	)
}

export default TrafficChart

