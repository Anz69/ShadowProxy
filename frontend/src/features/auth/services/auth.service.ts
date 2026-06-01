import axios, { type AxiosInstance } from "axios"

import type { LoginDto } from "@/features/auth/schemas/login.schema"
import type { RegisterDto } from "@/features/auth/schemas/register.schema"
import type { User } from "@/features/user/types/user.types"

import { extractError } from "@/shared/utils/extract-error"

export class AuthService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/auth`,
			withCredentials: true
		})
	}

	async register(dto: RegisterDto, recaptcha?: string) {
		try {
			const res = await this.api.post<{ user: User }>("/register", dto, {
				headers: {
					recaptcha
				}
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async login(dto: LoginDto, recaptcha?: string) {
		try {
			const res = await this.api.post<{ user: User }>("/login", dto, {
				headers: {
					recaptcha
				}
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async logout() {
		return this.api.post("/logout")
	}
}

export const authService = new AuthService()
