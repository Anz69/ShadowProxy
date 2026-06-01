import axios, { type AxiosInstance } from "axios"
import type { User } from "@/features/user/types/user.types"
import { extractError } from "@/shared/utils/extract-error"

export class VerificationService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/auth/email-confirmation`,
			withCredentials: true
		})
	}

	async verify(token: string | null) {
		try {
			const res = await this.api.post<{ user: User }>("/", {
				token
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

}

export const verificationService = new VerificationService()