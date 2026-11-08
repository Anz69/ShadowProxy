export type CampaignStats = {
	registrations: number
	trials: number
	payers: number
	payments: number
	revenue: number
	referrals: number
	spend: number
	cpa: number | null
	avgLtv: number | null
	cac: number | null
	arppu: number | null
	romi: number | null
	trialRate: number | null
	payerRate: number | null
}

export type Campaign = {
	id: string
	name: string
	source: string
	utmSource: string
	slug: string
	link: string
	createdAt: string
	updatedAt: string
	stats: CampaignStats
}

export type CampaignExpense = {
	id: string
	amount: number
	comment: string | null
	spentAt: string
	createdAt: string
}

export type CampaignNote = {
	id: string
	text: string
	createdAt: string
}

export type CampaignPoint = {
	date: string
	registrations: number
	trials: number
	payments: number
	payers: number
	revenue: number
	spend: number
}

export type CampaignUser = {
	id: string
	email: string
	tgLogin: string | null
	createdAt: string
	trial: string | null
	revenue: number
	referrals: number
}

export type CampaignDetail = Campaign & {
	expenses: CampaignExpense[]
	notes: CampaignNote[]
	period: { from: string; to: string; bucket: "day" | "week"; stats: CampaignStats }
	series: CampaignPoint[]
	users: CampaignUser[]
}
