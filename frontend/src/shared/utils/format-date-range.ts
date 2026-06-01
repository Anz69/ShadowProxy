import type { SupportedLocale } from "./i18n"

type TranslateFn = (key: string, params?: Record<string, string>) => string

const BASE_KEY = "package.trafficChart.dateRangeFormat"

/**
 * Formats a date range using translation templates.
 * Format templates use placeholders: {{day}}, {{month}}, {{year}}
 */
export function formatDateRangeSmart(
	startDate: Date,
	endDate: Date,
	locale: SupportedLocale,
	translate: TranslateFn
): { start: string; end: string } {
	const dateLocale = locale === "zh-CN" ? "zh-CN" : locale === "en" ? "en-US" : "ru-RU"
	const startYear = startDate.getFullYear()
	const endYear = endDate.getFullYear()
	const startMonth = startDate.getMonth()
	const endMonth = endDate.getMonth()
	const sameYear = startYear === endYear
	const sameMonth = sameYear && startMonth === endMonth

	const day = (d: Date) => d.getDate().toString()
	const month = (d: Date) =>
		locale === "zh-CN" ? (d.getMonth() + 1).toString() : d.toLocaleDateString(dateLocale, { month: "long" })
	const year = (d: Date) => d.getFullYear().toString()

	let formatKey: "sameMonth" | "differentMonths" | "differentYears"
	if (sameMonth) formatKey = "sameMonth"
	else if (sameYear) formatKey = "differentMonths"
	else formatKey = "differentYears"

	const start = translate(`${BASE_KEY}.${formatKey}.start`, {
		day: day(startDate),
		month: month(startDate),
		year: year(startDate)
	})
	const end = translate(`${BASE_KEY}.${formatKey}.end`, {
		day: day(endDate),
		month: month(endDate),
		year: year(endDate)
	})

	return { start, end }
}

/**
 * Формат даты с числовым месяцем (для мобильной версии).
 * Пример: "05.02 — 11.02.2025" или "28.01 — 03.02.2025"
 */
export function formatDateRangeNumeric(startDate: Date, endDate: Date): string {
	const fmt = (d: Date) => {
		const day = d.getDate().toString().padStart(2, "0")
		const month = (d.getMonth() + 1).toString().padStart(2, "0")
		const year = d.getFullYear().toString()
		return `${day}.${month}.${year}`
	}
	const start = fmt(startDate)
	const end = fmt(endDate)
	if (start === end) return start
	const startShort = `${startDate.getDate().toString().padStart(2, "0")}.${(startDate.getMonth() + 1).toString().padStart(2, "0")}`
	const endFull = end
	return `${startShort} — ${endFull}`
}

const AVERAGE_WEEK_LINES_KEY = "package.trafficChart.averageWeekLines"

// Русские месяцы в родительном падеже (февраля, декабря)
const RU_MONTH_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]

/**
 * Формат для блока «в среднем за неделю» — по строкам.
 * Для одного месяца: 4 строки (в среднем / за неделю / с X по Y / месяца год).
 * Для других форматов — как поместится.
 */
export function formatAverageWeekLines(
	startDate: Date,
	endDate: Date,
	locale: SupportedLocale,
	translate: TranslateFn
): { lines: string[] } {
	const dateLocale = locale === "zh-CN" ? "zh-CN" : locale === "en" ? "en-US" : "ru-RU"
	const startYear = startDate.getFullYear()
	const endYear = endDate.getFullYear()
	const startMonth = startDate.getMonth()
	const endMonth = endDate.getMonth()
	const sameYear = startYear === endYear
	const sameMonth = sameYear && startMonth === endMonth

	const day = (d: Date) => d.getDate().toString()
	const month = (d: Date) => {
		if (locale === "zh-CN") return (d.getMonth() + 1).toString()
		if (locale === "ru") return RU_MONTH_GENITIVE[d.getMonth()]
		return d.toLocaleDateString(dateLocale, { month: "long" })
	}
	const year = (d: Date) => d.getFullYear().toString()

	const line1 = translate(`${AVERAGE_WEEK_LINES_KEY}.line1`)
	const line2 = translate(`${AVERAGE_WEEK_LINES_KEY}.line2`)

	if (sameMonth) {
		const line3 = translate(`${AVERAGE_WEEK_LINES_KEY}.sameMonth.line3`, {
			start: day(startDate),
			end: day(endDate)
		})
		const line4 = translate(`${AVERAGE_WEEK_LINES_KEY}.sameMonth.line4`, {
			month: month(endDate),
			year: year(endDate)
		})
		return { lines: [line1, line2, line3, line4] }
	}

	// Разные месяцы или годы — одна строка с датами
	const { start, end } = formatDateRangeSmart(startDate, endDate, locale, translate)
	const line3 = translate(`${AVERAGE_WEEK_LINES_KEY}.other`, { start, end })
	return { lines: [line1, line2, line3] }
}
