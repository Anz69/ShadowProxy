import axios, { type AxiosInstance } from "axios"

import { extractError } from "@/shared/utils/extract-error"
import type { SupportMessage, SupportThread } from "@/features/support/types/support.types"

class SupportService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/support`,
			withCredentials: true
		})
	}

	async getThread(): Promise<SupportThread> {
		try {
			const res = await this.api.get<SupportThread>("/thread")
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async sendMessage(text: string, files: File[]): Promise<SupportMessage> {
		try {
			const form = new FormData()
			if (text.trim()) form.append("text", text.trim())
			for (const f of files) form.append("files", f)
			const res = await this.api.post<SupportMessage>("/messages", form)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async markRead(): Promise<void> {
		try {
			await this.api.post("/read")
		} catch {
			/* не критично */
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
}

export const supportService = new SupportService()
