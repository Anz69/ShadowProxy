export type BroadcastSegment = "all" | "trial_active" | "after_purchase" | "no_purchases"

export type Broadcast = {
	id: string
	title: string
	body: string
	link: string | null
	segment: BroadcastSegment
	recipientsCount: number
	createdAt: string
}

export type BroadcastList = {
	items: Broadcast[]
	total: number
	page: number
}

export const SEGMENT_LABELS: Record<BroadcastSegment, string> = {
	all: "Все пользователи",
	trial_active: "С активным триалом",
	after_purchase: "После первой покупки",
	no_purchases: "Без покупок"
}
