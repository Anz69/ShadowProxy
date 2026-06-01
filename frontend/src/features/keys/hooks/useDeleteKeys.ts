import { useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"

import { keysService } from "@/features/keys/services/keys.service"

export function useDeleteKeys() {
	const queryClient = useQueryClient()

	const { mutate: deleteKeys, isPending: isLoading } = useMutation({
		mutationKey: ["delete-key"],
		mutationFn: (keys: string[]) => keysService.deleteKeys(keys),
		onSuccess: () => {
			toast.success("Ключи успешно удалены")
			queryClient.invalidateQueries({
				queryKey: ["keys"]
			})
		},
		onError: ({ message }) => {
			toast.error(message)
		}
	})

	return {
		deleteKeys,
		isLoading
	}
}
