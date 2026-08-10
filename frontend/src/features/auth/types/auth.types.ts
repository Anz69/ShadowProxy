export type Account = {
	id: string
	type: string
	provider: "GOOGLE" | "TELEGRAM"
	providerAccountId: string
	refreshToken: string
	accessToken: string
	expiresAt: number
	createdAt: string
	updatedAt: string
	userId: string
}
