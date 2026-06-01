import { keepPreviousData } from "@tanstack/query-core"
import { useQuery } from "@tanstack/react-query"

import { proxyService } from "@/features/proxy/services/proxy.service"
import type { GetProxiesQueryParams } from "@/features/proxy/types/get-proxies.types"

export function useGetProxies(query: GetProxiesQueryParams) {
	const { data: paginatedProxies, isFetching: isLoading } = useQuery({
		queryKey: ["proxies", query],
		queryFn: async () => {
			await new Promise(resolve => setTimeout(resolve, 150))
			return proxyService.getMy(query)
		},
		initialData: {
			data: [],
			page: 1,
			totalPages: 1,
			totalItems: 0,
			next: false,
			prev: false
		},
		placeholderData: keepPreviousData
	})

	return {
		paginatedProxies,
		isLoading
	}
}
