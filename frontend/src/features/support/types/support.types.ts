export type SupportTicketStatus = "NEW" | "IN_PROGRESS" | "ANSWERED" | "CLOSED"
export type SupportAuthor = "USER" | "ADMIN"

export type SupportAttachment = {
	url: string
	name: string
	mime: string
	size: number
}

export type SupportMessage = {
	id: string
	ticketId: string
	authorRole: SupportAuthor
	text: string
	attachments: SupportAttachment[]
	readAt: string | null
	createdAt: string
}

export type SupportTicket = {
	id: string
	userId: string
	status: SupportTicketStatus
	lastMessageAt: string
	createdAt: string
	updatedAt: string
}

export type SupportThread = {
	ticket: SupportTicket | null
	messages: SupportMessage[]
}

/** Абсолютный URL вложения: бэк отдаёт относительный /api/uploads/..., NEXT_PUBLIC_BACKEND_URI заканчивается на /api. */
export const supportFileUrl = (relativeUrl: string): string => {
	const base = (process.env.NEXT_PUBLIC_BACKEND_URI || "").replace(/\/api\/?$/, "")
	return `${base}${relativeUrl}`
}
