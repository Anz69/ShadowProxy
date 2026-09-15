export type PromoMode = "ONE_TIME" | "MULTI_USE"

export type PromoRedemption = {
	id: string
	amount: string | number
	createdAt: string
	user: { id: string; email: string; tgLogin?: string | null }
}

export type PromoCode = {
	id: string
	code: string
	amount: string | number
	expiresAt: string
	mode: PromoMode
	active: boolean
	activationCount: number
	createdAt: string
	redemptions: PromoRedemption[]
}
