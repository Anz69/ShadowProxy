import { useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"

import type { ModifyProxyDto } from "@/features/proxy/schemas/modify-proxy.schema"
import { proxyService } from "@/features/proxy/services/proxy.service"

export function useModifyProxies() {
	const queryClient = useQueryClient()

	const { mutate: modifyProxies, isPending: isLoading } = useMutation({
		mutationKey: ["modify-proxies"],
		mutationFn: (dto: ModifyProxyDto) => proxyService.modifyProxy(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["proxies"]
			})
			toast.success("Прокси успешно сохранены")
		}
	})

	return {
		modifyProxies,
		isLoading
	}
}
