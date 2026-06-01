import { useMutation, useQueryClient } from "@tanstack/react-query"

import { packageService } from "@/features/packages/services/package.service"
import toast from "react-hot-toast"

export function useDeletePackage() {
	const queryClient = useQueryClient()

	const { mutate: deletePackage, isPending: isLoading } = useMutation({
		mutationKey: ["delete-package"],
		mutationFn: (id: string) => packageService.deletePackage(id),
		onSuccess: () => {
			toast.success("Пакет успешно удалён")
			queryClient.invalidateQueries({
				queryKey: ["packages"]
			})
		},
		onError: ({ message }) => toast.error(message)
	})

	return {
		deletePackage,
		isLoading
	}
}
