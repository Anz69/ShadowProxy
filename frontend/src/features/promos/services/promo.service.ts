import axios from "axios"
import { extractError } from "@/shared/utils/extract-error"
import type { PromoCode, PromoMode } from "../types/promo.types"

const client = axios.create({ baseURL: process.env.NEXT_PUBLIC_BACKEND_URI, withCredentials: true })

export const promoService = {
	async activate(code: string) {
		try {
			const { data } = await client.post<{ amount: number; balance: number; code: string }>("/promos/activate", { code })
			return data
		} catch (error) { throw new Error(extractError(error)) }
	},
	async list() {
		try { return (await client.get<PromoCode[]>("/admin/promos")).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async create(dto: { code?: string; amount: number; expiresAt: string; mode: PromoMode }) {
		try { return (await client.post<PromoCode>("/admin/promos", dto)).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async deactivate(id: string) {
		try { return (await client.patch<PromoCode>(`/admin/promos/${id}/deactivate`)).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async remove(id: string) {
		try { return (await client.delete<{ success: true }>(`/admin/promos/${id}`)).data }
		catch (error) { throw new Error(extractError(error)) }
	}
}
