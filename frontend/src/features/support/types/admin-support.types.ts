import type { SupportAttachment, SupportMessage, SupportTicketStatus } from "./support.types"

export type AdminTicketListItem = {
	id: string
	status: SupportTicketStatus
	lastMessageAt: string
	createdAt: string
	user: { id: string; email: string; tgLogin: string | null }
	lastMessage: { text: string; authorRole: "USER" | "ADMIN"; attachments: SupportAttachment[]; createdAt: string } | null
	unreadFromUser: number
}

export type AdminTicketsResponse = {
	total: number
	page: number
	limit: number
	tickets: AdminTicketListItem[]
}

export type AdminTicketUser = {
	id: string
	email: string
	tgLogin: string | null
	authMethod: string
	balance: string
	createdAt: string
	premiumTrafficLeft: string
	premiumResidentialTrafficLeft: string
	mobileGbTrafficLeft: string
	mobileTrafficLeft: string
	ipv6GbTrafficLeft: string
	ispUsaTrafficLeft: string
	ispEuTrafficLeft: string
	residentialLiteTrafficLeft: string
}

export type AdminTicketDetail = {
	ticket: {
		id: string
		userId: string
		status: SupportTicketStatus
		lastMessageAt: string
		createdAt: string
		user: AdminTicketUser
	}
	messages: SupportMessage[]
}

export type AdminUserProxy = {
	id: string
	type: string
	country: string | null
	status: "ACTIVE" | "SUSPENDED"
	rotation: string
	serverHost: string | null
	userPort: number | null
	userLogin: string | null
	userPassword: string | null
	trafficUsed: string
	createdAt: string
	lastActivityAt: string | null
}

export type AdminGeneration = {
	id: string
	createdAt: string
	packageType: string | null
	quantity: number | null
	location: string | null
	rotation: string | null
	rotationInterval: number | null
}

export type AdminUserProxies = {
	proxies: AdminUserProxy[]
	generations: AdminGeneration[]
}

export type ProxyCheckResult = {
	works: boolean
	exitIp: string | null
	country: string | null
	pingMs: number | null
	error: string | null
}
