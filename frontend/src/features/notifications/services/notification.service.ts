import axios, { type AxiosInstance } from "axios"
import { extractError } from "@/shared/utils/extract-error"

export type AppNotification = {
	id: string
	type: string
	title: string
	body: string
	link: string | null
	readAt: string | null
	createdAt: string
}

class NotificationService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/notifications`,
			withCredentials: true
		})
	}

	async list(page = 1): Promise<AppNotification[]> {
		try {
			const res = await this.api.get<AppNotification[]>("", { params: { page } })
			return res.data ?? []
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async unreadCount(): Promise<number> {
		try {
			const res = await this.api.get<{ count: number }>("/unread-count")
			return res.data?.count ?? 0
		} catch {
			return 0
		}
	}

	async markRead(id: string): Promise<void> {
		try {
			await this.api.patch(`/${id}/read`)
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async markAllRead(): Promise<{ count: number }> {
		try {
			const res = await this.api.patch<{ count: number }>("/read-all")
			return res.data ?? { count: 0 }
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const notificationService = new NotificationService()
