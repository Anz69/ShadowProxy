export enum UserRole {
	User = "USER",
	Admin = "ADMIN",
	Banned = "BANNED"
}

export enum AuthMethod {
	Credentials = "CREDENTIALS",
	Google = "GOOGLE"
}

export enum UserRegion {
	Cis = "CIS",
	Europe = "EUROPE",
	Usa = "USA"
}

export type User = {
	id: string
	email: string
	authMethod: AuthMethod
	role: UserRole
	emailVerified: boolean
	residentTrafficLeft: string
	premiumTrafficLeft: string
	region: UserRegion
	createdAt: string
	updatedAt: string
	account: Account[]
}

export type Account = {
	id: string
	type: string
	provider: "GOOGLE"
	providerAccountId: string
	refreshToken: string
	accessToken: string
	expiresAt: number
	createdAt: string
	updatedAt: string
	userId: string
}
