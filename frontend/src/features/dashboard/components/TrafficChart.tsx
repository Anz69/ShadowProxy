"use client"

import { ChevronRight, ChevronLeft } from "lucide-react"
import { type FC, useState, useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t, type SupportedLocale } from "@/shared/utils/i18n"
import { packageService } from "@/features/packages/services/package.service"
import { formatTraffic } from "@/shared/utils/format-traffic"
import { formatDateRangeSmart, formatDateRangeNumeric, formatAverageWeekLines } from "@/shared/utils/format-date-range"

type TrafficData = {
	day: string
	date: string
	value: bigint | null
	isToday?: boolean
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
	const [selectedPeriod, setSelectedPeriod] = useState("")
	
	useEffect(() => {
		if (!packageId) {
			setSelectedPeriod(t("package.trafficChart.week", locale))
		}
	}, [locale, packageId])

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

	// Вычисляем максимальное значение для масштабирования
	const maxValue = useMemo(() => {
		const values = weekData.map(d => d.value).filter((v): v is bigint => v !== null)
		if (values.length === 0) return BigInt(1)
		return values.reduce((max, val) => (val > max ? val : max), BigInt(0))
	}, [weekData])

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

	const dateRangeNumeric = useMemo(() => {
		const startDate = currentWeekStart
		const endDate = new Date(startDate)
		endDate.setDate(startDate.getDate() + 6)
		return formatDateRangeNumeric(startDate, endDate)
	}, [currentWeekStart])

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

	// Вычисляем максимальное значение для масштабирования (для статического режима)
	const maxValueStatic = packageId 
		? maxValue 
		: BigInt(1)

	// Среднее значение (для статического режима)
	const averageValue = packageId && stats.length > 0
		? Number(averagePerDay) / (1024 ** 3)
		: 2.0

	// Форматированное значение для блока статистики
	const averageDisplayValue = packageId 
		? (Number(averagePerDay) / (1024 ** 3)).toFixed(1).replace(".", ",")
		: averageValue.toFixed(1).replace(".", ",")

	// Размер шрифта: 48px по умолчанию, уменьшаем если не поместится в 124px (минус padding 16px = 108px)
	const averageFontSize = useMemo(() => {
		const maxWidth = 100 // 124px - 12px*2 padding с запасом
		const defaultSize = 48
		const minSize = 24
		const charCount = averageDisplayValue.length
		// ~0.6 — примерная ширина символа в em для Struve (цифры)
		const estimatedWidth = charCount * defaultSize * 0.6
		if (estimatedWidth <= maxWidth) return defaultSize
		return Math.max(minSize, Math.floor(maxWidth / (charCount * 0.6)))
	}, [averageDisplayValue])

	return (
		<div className="traffic-chart-mobile bg-white/10 rounded-3xl p-10 flex flex-col justify-between" style={{ width: "1021px", maxWidth: "100%", height: "526px", gap: "24px" }}>
			{/* Header */}
			<div className="traffic-chart__header flex flex-row justify-between items-baseline gap-3">
				<div className="traffic-chart__header-title flex flex-row items-baseline gap-2 flex-nowrap">
					<h2 className="text-white text-[32px] font-normal leading-none whitespace-nowrap" style={{ fontFamily: "Struve" }}>
						{T("package.trafficChart.title")}{" "}
						<span className="opacity-30">{T("package.trafficChart.gb")}</span>
					</h2>
				</div>
				{!packageId && (
					<button className="border border-white/20 rounded-lg px-5 py-[10px] flex flex-row justify-between items-center gap-3" style={{ width: "260px", height: "44px" }}>
						<span className="text-white text-base font-normal leading-[1.4] tracking-[-0.01em]" style={{ fontFamily: "Struve" }}>
							{selectedPeriod}
						</span>
						<ChevronRight className="w-[17.6px] h-[17.6px] text-white" />
					</button>
				)}
			</div>

			{/* Main Content */}
			<div className="traffic-chart__main flex flex-row gap-6 flex-1 min-w-0" style={{ paddingTop: "20px" }}>
				{/* Chart Area */}
				<div className="traffic-chart__chart-area flex flex-col gap-5 flex-1 min-w-0 relative">
					{/* Days Grid */}
					<div className="traffic-chart__days-grid flex flex-row justify-stretch items-end gap-3 flex-1">
						{trafficData.map((item, index) => (
							<div
								key={index}
								className="flex flex-col items-center gap-2"
								style={{ flex: 1, height: "100%" }}
							>
								<div className="flex flex-col items-center gap-3 w-full" style={{ flex: 1, justifyContent: "flex-end" }}>
									<div
										className={`w-full rounded-xl flex items-center justify-center ${
											item.isToday
												? "border-2 border-white bg-[#0067FF]"
												: item.value !== null
													? "bg-[#0067FF]"
													: "border border-[#0067FF]"
										}`}
									style={{
										height: item.value !== null && maxValueStatic > BigInt(0)
											? `${Number((item.value * BigInt(100)) / maxValueStatic)}%`
											: "39px",
											minHeight: item.value === null ? "39px" : "auto",
											position: "relative"
										}}
									>
										<span className="text-white text-xl font-semibold leading-[1.2] tracking-[-0.01em] text-center w-full absolute" style={{ fontFamily: "Struve", bottom: "100%", marginBottom: "8px" }}>
											{item.value !== null 
												? packageId 
													? formatTraffic(item.value.toString())
													: (Number(item.value) / (1024 ** 3)).toFixed(1).replace(".", ",")
												: "—"}
										</span>
										<div className="absolute left-0 right-0 bottom-0 flex justify-center pb-2">
											<span className="traffic-chart__column-date text-white text-base font-normal tracking-[-0.01em] text-center opacity-50" style={{ fontFamily: "Struve", lineHeight: "normal" }}>
												{item.date}
											</span>
										</div>
									</div>
									<span className="text-white text-base font-normal leading-[1.3] tracking-[-0.01em] text-center opacity-50 w-full" style={{ fontFamily: "Struve" }}>
										{item.day}
									</span>
								</div>
							</div>
						))}
					</div>

					{/* Date Navigation */}
					<div className="traffic-chart__nav flex flex-row items-center justify-between w-full relative">
						<button
							onClick={handlePrev}
							disabled={!canGoBack}
							className={`rounded-xl flex items-center justify-center ${
								canGoBack
									? "bg-white/10 cursor-pointer hover:bg-white/20"
									: "bg-[#2A2D35] cursor-not-allowed opacity-50"
							}`}
							style={{ width: "170px", height: "44px", padding: "7.33px 26.4px", gap: "5.87px" }}
						>
							<ChevronLeft className="w-[20px] h-[20px] text-white" />
						</button>
						<span className="traffic-chart__nav-date traffic-chart__nav-date-desktop text-white text-xl font-semibold leading-[1.2] tracking-[-0.01em] absolute" style={{ fontFamily: "Struve", left: "50%", transform: "translateX(-50%)" }}>
							{packageId ? dateRange : "15 — 21.12.2025"}
						</span>
						<span className="traffic-chart__nav-date traffic-chart__nav-date-mobile text-white text-xl font-semibold leading-[1.2] tracking-[-0.01em] absolute" style={{ fontFamily: "Struve", left: "50%", transform: "translateX(-50%)" }}>
							{packageId ? dateRangeNumeric : "15 — 21.12.2025"}
						</span>
						<button
							onClick={handleNext}
							disabled={!canGoForward}
							className={`rounded-xl flex items-center justify-center ${
								canGoForward
									? "bg-white/10 cursor-pointer hover:bg-white/20"
									: "bg-[#2A2D35] cursor-not-allowed opacity-50"
							}`}
							style={{ width: "170px", height: "44px", padding: "7.33px 26.4px", gap: "5.87px" }}
						>
							<ChevronRight className="w-[20px] h-[20px] text-white" />
						</button>
					</div>
				</div>

				{/* Sidebar Stats — 124px с учётом viewport-scale */}
				<div className="traffic-chart__sidebar flex flex-row items-center gap-[10px] shrink-0" style={{ alignSelf: "stretch", width: "124px", minWidth: "124px", maxWidth: "124px" }}>
					<div className="traffic-chart__sidebar-inner border border-[#5F6169] rounded-xl flex flex-col justify-between gap-[6px] relative overflow-hidden w-full" style={{ padding: "12px 8px", height: "100%", boxSizing: "border-box" }}>
						<div className="absolute inset-0" style={{ backgroundImage: "url('/packages/pc-proxy-used.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", opacity: 0.7, zIndex: 0 }}></div>
						<div className="relative" style={{ zIndex: 1, width: "100%", overflow: "hidden" }}>
							<div className="traffic-chart__sidebar-avg flex flex-col gap-1 min-w-0 overflow-hidden" style={{ maxWidth: "100%" }}>
								<span 
									className="traffic-chart__sidebar-avg-value font-normal leading-none block truncate" 
									style={{ 
										fontFamily: "Struve", 
										color: "#0067FF",
										fontSize: `${averageFontSize}px`,
										maxWidth: "100%",
										overflow: "hidden",
										textOverflow: "ellipsis"
									}}
								>
									{averageDisplayValue}
								</span>
								<span className="traffic-chart__sidebar-avg-gb text-white text-[24px] font-normal leading-none" style={{ fontFamily: "Struve", opacity: 0.4 }}>
									{T("package.trafficChart.gb")}
								</span>
							</div>
						</div>
						<div className="traffic-chart__sidebar-dates flex flex-col text-white text-sm font-normal leading-[1.3] tracking-[-0.01em] opacity-50 relative text-left" style={{ fontFamily: "Struve", zIndex: 1 }}>
							<span className="traffic-chart__sidebar-dates-desktop">
								{packageId 
									? formatAverageWeekLines(
										currentWeekStart,
										(() => {
											const end = new Date(currentWeekStart)
											end.setDate(end.getDate() + 6)
											return end
										})(),
										locale,
										(key, params) => t(key, locale, params)
									).lines.join(" ")
									: T("package.trafficChart.averageWeek")
								}
							</span>
							<span className="traffic-chart__sidebar-dates-mobile">{packageId ? dateRangeNumeric : "15 — 21.12.2025"}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default TrafficChart

