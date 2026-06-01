import axios, { type AxiosInstance } from "axios"

import type { IssuePremiumResidentialProxy, IssueMobileV2Proxy, Proxy } from "@/features/proxy/types/proxy.types"
import { extractError } from "@/shared/utils/extract-error"

type ConnectionType = "residential" | "mobile"

export class ProxyEmpireService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/proxy`,
			withCredentials: true
		})
	}

	async getRegions(connectionType: ConnectionType, countryCode: string): Promise<string[]> {
		const res = await this.api.get<string[]>("/empire/regions", {
			params: { connection_type: connectionType, country_code: countryCode }
		})
		return res.data ?? []
	}

	async getCities(connectionType: ConnectionType, countryCode: string, region?: string): Promise<string[]> {
		const res = await this.api.get<string[]>("/empire/cities", {
			params: { connection_type: connectionType, country_code: countryCode, ...(region ? { region } : {}) }
		})
		return res.data ?? []
	}

	async getIsps(connectionType: ConnectionType, countryCode: string, region?: string, city?: string): Promise<string[]> {
		const res = await this.api.get<string[]>("/empire/isps", {
			params: {
				connection_type: connectionType,
				country_code: countryCode,
				...(region ? { region } : {}),
				...(city ? { city } : {})
			}
		})
		return res.data ?? []
	}

	// Mango Residential Proxy filters (задача 2 ТЗ)
	async getMangoRegions(countryCode: string): Promise<string[]> {
		const res = await this.api.get<string[]>("/mango/regions", {
			params: { country_code: countryCode }
		})
		return res.data ?? []
	}

	async getMangoCities(countryCode: string, region?: string): Promise<string[]> {
		const res = await this.api.get<string[]>("/mango/cities", {
			params: { country_code: countryCode, ...(region ? { region } : {}) }
		})
		return res.data ?? []
	}

	async getMangoIsps(countryCode: string, region?: string, city?: string): Promise<string[]> {
		const res = await this.api.get<string[]>("/mango/isps", {
			params: {
				country_code: countryCode,
				...(region ? { region } : {}),
				...(city ? { city } : {})
			}
		})
		return res.data ?? []
	}

	async issuePremiumResidential(dto: IssuePremiumResidentialProxy): Promise<Proxy[]> {
		try {
			const res = await this.api.post<Proxy[]>("/issue/premium-residential", dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async issueMobile(dto: IssueMobileV2Proxy): Promise<Proxy[]> {
		try {
			const res = await this.api.post<Proxy[]>("/issue/mobile", dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const proxyEmpireService = new ProxyEmpireService()
