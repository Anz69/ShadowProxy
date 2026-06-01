import axios, { type AxiosInstance } from "axios"

import type { PackageDto } from "@/features/admin/schemas/package.schema"
import type { CreateKeyDto } from "@/features/keys/schemas/create-key.schema"
import type { RedeemKeyDto } from "@/features/keys/schemas/redeem-key.schema"
import type { Key } from "@/features/keys/types/keys.types"
import type { Package } from "@/features/packages/types/packages.types"

import { extractError } from "@/shared/utils/extract-error"

class KeysService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/key`,
			withCredentials: true
		})
	}

	async createKey(dto: CreateKeyDto) {
		try {
			const res = await this.api.post<Key[]>(`/create`, dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async deleteKeys(keys: string[]) {
		try {
			const res = await this.api.post<{ success: boolean }>(`/delete`, {
				keys
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async redeemKey(dto: RedeemKeyDto) {
		try {
			const res = await this.api.post<Key>(`/redeem`, dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getAll() {
		const res = await this.api.get<Key[]>("/all")
		return res.data
	}
}

export const keysService = new KeysService()
