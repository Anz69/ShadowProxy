import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import type { ModifyPricesDto } from "@/features/admin/schemas/modify-prices.schema"
import { adminService } from "@/features/admin/serices/admin.service"

export function useModifyPrices() {
	const router = useRouter()

	const { mutate: modifyPrices, isPending: isLoading } = useMutation({
		mutationKey: ["prices"],
		mutationFn: (dto: ModifyPricesDto) => adminService.modifyPrices(dto),
		onSuccess: () => {
			// Принудительно обновляем серверные данные (cache: no-store в getPrices гарантирует свежие значения)
			router.refresh()
		}
	})

	return {
		modifyPrices,
		isLoading
	}
}
