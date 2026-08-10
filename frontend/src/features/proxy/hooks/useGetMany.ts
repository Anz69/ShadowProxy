import { proxyService } from "@/features/proxy/services/proxy.service"
import { useQuery } from "@tanstack/react-query"

export function useGetMany(proxyIds: string[]) {
	const { data: proxies, isFetching: isLoading } = useQuery({
		queryKey: ["proxies", proxyIds],
		queryFn: () => proxyService.getMany(proxyIds),
		initialData: []
	})

	return {proxies, isLoading}
}