import { useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"

import type { CreateKeyDto } from "@/features/keys/schemas/create-key.schema"
import { keysService } from "@/features/keys/services/keys.service"

export function useCreateKey() {
	const queryClient = useQueryClient()

	const { mutate: createKey, isPending: isLoading, data: createdKeys } = useMutation({
		mutationKey: ["new-key"],
		mutationFn: (dto: CreateKeyDto) => keysService.createKey(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["keys"]
			})
			toast.success("Ключи успешно созданы")
		}
	})

	return {
		createKey,
		isLoading,
		createdKeys
	}
}
