import type { Proxy, ProxyType } from "@/features/proxy/types/proxy.types"

export type GetProxiesQueryParams = {
	type: ProxyType
	sort: ProxiesSort
	limit: number
	page: number
}

export type PaginatedProxies = {
	data: Proxy[]
	page: number
	totalPages: number
	totalItems: number
	next: boolean
	prev: boolean
}

export type ProxiesSort = "created_at_desc" | "created_at_asc"
