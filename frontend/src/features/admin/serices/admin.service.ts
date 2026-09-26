import axios, { type AxiosInstance } from "axios"

import type { CreateBroadcastDto } from "@/features/admin/schemas/broadcast.schema"
import type { ModifyPricesDto } from "@/features/admin/schemas/modify-prices.schema"
import type {
	Broadcast,
	BroadcastList,
	BroadcastSegment
} from "@/features/admin/types/broadcast.types"
import type {
	CreateProxyTestDto,
	ProxyTestCatalog,
	ProxyTestRun
} from "@/features/admin/types/proxy-test.types"

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

	// ───────── Массовые рассылки (Часть 5.3) ─────────

	async createBroadcast(dto: CreateBroadcastDto) {
		try {
			const res = await this.api.post<Broadcast>("/broadcasts", dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async listBroadcasts(page = 1) {
		try {
			const res = await this.api.get<BroadcastList>("/broadcasts", {
				params: { page }
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async broadcastAudience(segment: BroadcastSegment) {
		try {
			const res = await this.api.get<{ count: number }>(
				"/broadcasts/audience",
				{ params: { segment } }
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getProxyTestCatalog() {
		try {
			const res = await this.api.get<ProxyTestCatalog>(
				"/proxy-tests/catalog"
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async createProxyTest(dto: CreateProxyTestDto) {
		try {
			const res = await this.api.post<ProxyTestRun>(
				"/proxy-tests/runs",
				dto
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getCurrentProxyTest() {
		try {
			const res = await this.api.get<ProxyTestRun | null>(
				"/proxy-tests/runs/current"
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getProxyTestRun(id: string) {
		try {
			const res = await this.api.get<ProxyTestRun>(
				`/proxy-tests/runs/${id}`
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const adminService = new AdminService()
