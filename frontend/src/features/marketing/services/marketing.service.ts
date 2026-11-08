import axios from "axios"
import { extractError } from "@/shared/utils/extract-error"
import type { Campaign, CampaignDetail, CampaignExpense, CampaignNote } from "../types/marketing.types"

const client = axios.create({ baseURL: process.env.NEXT_PUBLIC_BACKEND_URI, withCredentials: true })
const base = "/admin/marketing/campaigns"

export const marketingService = {
	async list() {
		try { return (await client.get<Campaign[]>(base)).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async detail(id: string, period: { from?: string; to?: string }) {
		try { return (await client.get<CampaignDetail>(`${base}/${id}`, { params: period })).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async create(dto: { name: string; source: string; note?: string }) {
		try { return (await client.post<Campaign>(base, dto)).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async update(id: string, dto: { name?: string; source?: string }) {
		try { return (await client.patch<Campaign>(`${base}/${id}`, dto)).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async addExpense(id: string, dto: { amount: number; spentAt?: string; comment?: string }) {
		try { return (await client.post<CampaignExpense>(`${base}/${id}/expenses`, dto)).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async removeExpense(id: string, expenseId: string) {
		try { return (await client.delete<{ success: true }>(`${base}/${id}/expenses/${expenseId}`)).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async addNote(id: string, text: string) {
		try { return (await client.post<CampaignNote>(`${base}/${id}/notes`, { text })).data }
		catch (error) { throw new Error(extractError(error)) }
	},
	async removeNote(id: string, noteId: string) {
		try { return (await client.delete<{ success: true }>(`${base}/${id}/notes/${noteId}`)).data }
		catch (error) { throw new Error(extractError(error)) }
	}
}
