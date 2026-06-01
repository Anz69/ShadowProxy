import axios, { type AxiosInstance } from "axios"

import type { GetProxiesQueryParams, PaginatedProxies } from "@/features/proxy/types/get-proxies.types"
import type {
	IssueIspProxy,
	Prices,
	Proxy
} from "@/features/proxy/types/proxy.types"

import { extractError } from "@/shared/utils/extract-error"
import type { ModifyProxyDto } from "@/features/proxy/schemas/modify-proxy.schema"

export class ProxyService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/proxy`,
			withCredentials: true
		})
	}

	async getPrices() {
		const res = await this.api.get<Prices>("/prices")
		return res.data
	}

	async getMy(params: GetProxiesQueryParams) {
		const res = await this.api.get<PaginatedProxies>("/my", {
			params
		})
		return res.data
	}

	async getMany(proxyIds: string[]) {
		const res = await this.api.post<Proxy[]>("/get-many", {
			proxyIds
		})
		return res.data
	}

	async issueIspProxy(dto: IssueIspProxy) {
		try {
			const res = await this.api.post<Proxy[]>("/issue/isp", dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async modifyProxy(dto: ModifyProxyDto) {
		try {
			const res = await this.api.patch<Proxy[]>("/modify", dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const proxyService = new ProxyService()
