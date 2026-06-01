import { useQuery } from "@tanstack/react-query"

import { keysService } from "@/features/keys/services/keys.service"

export function useGetAllKeys() {
	const { data: keys, isLoading } = useQuery({
		queryKey: ["keys"],
		queryFn: () => keysService.getAll()
	})

	return {
		keys,
		isLoading
	}
}
