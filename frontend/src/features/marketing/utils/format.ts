/** Совпадает с ключами SOURCE_UTM на бэкенде — для них utm_source фиксированный. */
export const CAMPAIGN_SOURCES = [
	"Telegram Ads",
	"Telegram-каналы",
	"Google Ads",
	"Яндекс Директ",
	"Facebook / Instagram",
	"TikTok",
	"YouTube",
	"VK Реклама",
	"Блогеры",
	"Форумы"
]

export const usd = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `$${v.toFixed(2)}`)
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`)
export const int = (v: number) => v.toLocaleString("ru-RU")

export const toDateInput = (d: Date) => d.toISOString().slice(0, 10)
