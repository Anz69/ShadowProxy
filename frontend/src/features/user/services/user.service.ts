import axios, { type AxiosInstance } from "axios"
import { extractError } from "@/shared/utils/extract-error"
import type { AdminUser } from "@/features/user/types/user.types"
import type { User } from "@/features/user/types/user.types"
import type { ModifyTrafficDto } from "@/features/admin/schemas/mofify-traffic.schema"
import type { ModifyBalanceDto } from "@/features/admin/schemas/modify-balance.schema"

class UserService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/users`,
			withCredentials: true
		})
	}

	async getAll() {
		try {
			const res = await this.api.get<AdminUser[]>("/all",)
			return res.data
		} catch {
			return []
		}
	}

	async modifyTraffic(id: string, dto: ModifyTrafficDto) {
		try {
			const res = await this.api.patch<User>(`/${id}/traffic`, dto)

			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async modifyBalance(id: string, dto: ModifyBalanceDto) {
		try {
			const res = await this.api.patch<User>(`/${id}/balance`, dto)

			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getApiKey() {
		try {
			const res = await this.api.get<{ apiKey: string | null }>("/api-key")
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async generateApiKey() {
		try {
			const res = await this.api.post<{ apiKey: string }>("/api-key/generate")
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getReferralsCount() {
		try {
			const res = await this.api.get<{ count: number }>("/referrals/count")
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getMe() {
		try {
			const res = await this.api.get<User>("/me")
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const userService = new UserService()