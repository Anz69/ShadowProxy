import { useQuery } from "@tanstack/react-query"

import { proxyService } from "@/features/proxy/services/proxy.service"

export function usePrices() {
	const { data: prices, isPending: isLoading } = useQuery({
		queryKey: ["prices"],
		queryFn: () => proxyService.getPrices()
	})

	return {
		prices,
		isLoading
	}
}
