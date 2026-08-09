import axios, { type AxiosInstance } from "axios"

import { extractError } from "@/shared/utils/extract-error"
import type { SupportMessage, SupportTicketStatus } from "@/features/support/types/support.types"
import type {
	AdminTicketDetail,
	AdminTicketsResponse,
	AdminUserProxies,
	ProxyCheckResult
} from "@/features/support/types/admin-support.types"

export type AdminTicketFilter = {
	page: number
	limit: number
	status?: SupportTicketStatus | ""
	search?: string
}

class AdminSupportService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/admin/support`,
			withCredentials: true
		})
	}

	async listTickets(filter: AdminTicketFilter): Promise<AdminTicketsResponse> {
		try {
			const res = await this.api.get<AdminTicketsResponse>("/tickets", {
				params: {
					page: filter.page,
					limit: filter.limit,
					...(filter.status ? { status: filter.status } : {}),
					...(filter.search?.trim() ? { search: filter.search.trim() } : {})
				}
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async unreadCount(): Promise<number> {
		try {
			const res = await this.api.get<{ count: number }>("/unread-count")
			return res.data.count
		} catch {
			return 0
		}
	}

	async getTicket(ticketId: string): Promise<AdminTicketDetail> {
		try {
			const res = await this.api.get<AdminTicketDetail>(`/tickets/${ticketId}`)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async markRead(ticketId: string): Promise<void> {
		try {
			await this.api.post(`/tickets/${ticketId}/read`)
		} catch {
			/* не критично */
		}
	}

	async reply(ticketId: string, text: string, files: File[]): Promise<SupportMessage> {
		try {
			const form = new FormData()
			if (text.trim()) form.append("text", text.trim())
			for (const f of files) form.append("files", f)
			const res = await this.api.post<SupportMessage>(`/tickets/${ticketId}/messages`, form)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async setStatus(ticketId: string, status: SupportTicketStatus): Promise<void> {
		try {
			await this.api.patch(`/tickets/${ticketId}/status`, { status })
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getUserProxies(userId: string): Promise<AdminUserProxies> {
		try {
			const res = await this.api.get<AdminUserProxies>(`/users/${userId}/proxies`)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async checkProxy(proxyId: string): Promise<ProxyCheckResult> {
		try {
			const res = await this.api.post<ProxyCheckResult>(`/proxies/${proxyId}/check`)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const adminSupportService = new AdminSupportService()
