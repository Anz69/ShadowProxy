import axios, { type AxiosInstance } from "axios"

import type {
	RequestPasswordResetDto,
	ResetPasswordDto
} from "@/features/auth/schemas/password-recovery.schema"

import { extractError } from "@/shared/utils/extract-error"

export class PasswordResetService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/auth/reset-password`,
			withCredentials: true
		})
	}

	async requestPasswordReset(
		dto: RequestPasswordResetDto,
		recaptcha?: string
	) {
		try {
			const res = await this.api.post("/request", dto, {
				headers: recaptcha ? { recaptcha } : undefined
			})

			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async resetPassword(dto: ResetPasswordDto & { token: string }) {
		try {
			const res = await this.api.post("/", dto)

			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const passwordResetService = new PasswordResetService()
