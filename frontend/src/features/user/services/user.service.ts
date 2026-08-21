import axios, { type AxiosInstance } from "axios"
import { extractError } from "@/shared/utils/extract-error"
import type { AdminUsersParams, AdminUsersResponse, UserStats } from "@/features/user/types/user.types"
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

	/** Админ-список: серверная пагинация + поиск + сортировка. */
	async getAll(params: AdminUsersParams) {
		try {
			const res = await this.api.get<AdminUsersResponse>("/all", {
				params: {
					page: params.page,
					limit: params.limit,
					sortBy: params.sortBy,
					sortDir: params.sortDir,
					...(params.search?.trim() ? { search: params.search.trim() } : {})
				}
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	/** Статистика трафика юзера для админ-модалки (лениво, по клику). */
	async getUserStatsAdmin(userId: string) {
		try {
			const res = await this.api.get<UserStats>(`/${userId}/stats`)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
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

	/**
	 * Проверка текущей сессии для persistent UI (например, Header).
	 * 401 — нормальное состояние гостя, остальные ошибки оставляем React Query,
	 * чтобы он повторил запрос и не зафиксировал временно неправильную роль.
	 */
	async getCurrentSessionUser(): Promise<User | null> {
		try {
			const res = await this.api.get<User>("/me")
			return res.data
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.status === 401) return null
			throw error
		}
	}
}

export const userService = new UserService()
