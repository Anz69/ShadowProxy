import axios, { type AxiosInstance } from "axios"
import type { ModifyPricesDto } from "@/features/admin/schemas/modify-prices.schema"
import { extractError } from "@/shared/utils/extract-error"

class AdminService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/admin`,
			withCredentials: true
		})
	}

	async modifyPrices(dto: ModifyPricesDto) {
		try {
			const res = await this.api.post<ModifyPricesDto>("/prices", dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const adminService = new AdminService()