import axios, { type AxiosInstance } from "axios"

import type { PackageDto } from "@/features/admin/schemas/package.schema"
import type { Package } from "@/features/packages/types/packages.types"
import type { UserPackage } from "@/features/packages/types/user-package.types"

import { extractError } from "@/shared/utils/extract-error"

class PackageService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/package`,
			withCredentials: true
		})
	}

	async getAll() {
		const res = await this.api.get<Package[]>("/all")
		return res.data
	}

	async modifyPackage(id: string, dto: PackageDto) {
		try {
			const res = await this.api.patch<Package>(`/${id}`, dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async createPackage(dto: PackageDto) {
		try {
			const res = await this.api.post<Package>(`/`, dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async deletePackage(id: string) {
		try {
			const res = await this.api.delete<Package>(`/${id}`)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getTrafficStats(
		packageId: string,
		startDate: string,
		endDate: string,
		groupBy: "hour" | "day" = "day"
	) {
		try {
			const res = await this.api.get<
				Array<{
					date: string
					hour?: number
					inBytes: string
					outBytes: string
					totalBytes: string
				}>
			>(`/${packageId}/traffic-stats`, {
				params: {
					startDate,
					endDate,
					groupBy
				}
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getTrafficBounds(packageId: string) {
		try {
			const res = await this.api.get<{
				firstDate: string | null
				lastDate: string | null
			}>(`/${packageId}/traffic-bounds`)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async activatePackage(packageId: string) {
		try {
			const res = await this.api.post<{ id: string; package: Package }>("/activate", {
				packageId
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async activatePackageByType(type: string) {
		try {
			const res = await this.api.post<{ id: string; package: Package }>("/activate-by-type", {
				type
			})
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getMyPackages(): Promise<UserPackage[]> {
		try {
			const res = await this.api.get<UserPackage[]>("/user/my")
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async generatePackageProxy(packageId: string, dto: { location?: string; rotation?: "BY_REQUEST" | "BY_TIME"; quantity?: number; rotationInterval?: number; region?: string; city?: string; isp?: string }) {
		try {
			const res = await this.api.post<{
				proxyPort: {
					id: string
					port: number
					login: string
					password: string
					serverHost: string
				}
				providerProxy: {
					host: string
					port: number
					username: string
					password: string
				}
			} | Array<{
				proxyPort: {
					id: string
					port: number
					login: string
					password: string
					serverHost: string
				}
				providerProxy: {
					host: string
					port: number
					username: string
					password: string
				}
			}>>(`/${packageId}/generate-proxy`, dto)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async refreshAllPackageProxies(packageId: string) {
		try {
			const res = await this.api.post<{
				success: boolean
				total: number
				successCount: number
				errorCount: number
				results: Array<{
					proxyId: string
					success: boolean
					ip?: string
					error?: string
				}>
			}>(`/${packageId}/refresh-all-proxies`)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}
}

export const packageService = new PackageService()
