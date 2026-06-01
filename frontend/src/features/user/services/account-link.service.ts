import axios, { type AxiosInstance } from "axios"
import { extractError } from "@/shared/utils/extract-error"

class AccountLinkService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/auth`,
			withCredentials: true
		})
	}

	startGoogleLink() {
		window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URI}/auth/link/google`
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async linkTelegram(payload: any): Promise<void> {
		try {
			await this.api.post("/link/telegram", payload)
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async unlink(provider: "GOOGLE" | "TELEGRAM"): Promise<void> {
		try {
			await this.api.delete(`/link/${provider.toLowerCase()}`)
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const accountLinkService = new AccountLinkService()
