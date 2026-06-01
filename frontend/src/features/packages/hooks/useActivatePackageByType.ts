import { useMutation, useQueryClient } from "@tanstack/react-query"
import { packageService } from "@/features/packages/services/package.service"
import toast from "react-hot-toast"

export function useActivatePackageByType() {
	const queryClient = useQueryClient()

	const { mutate, isPending: isLoading } = useMutation({
		mutationKey: ["activate-package-by-type"],
		mutationFn: (type: string) => packageService.activatePackageByType(type),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["packages"]
			})
			queryClient.invalidateQueries({
				queryKey: ["user-packages"]
			})
			toast.success("Пакет успешно активирован!")
		},
		onError: (error: Error) => {
			toast.error(error.message)
		}
	})

	return {
		activatePackageByType: mutate,
		isLoading
	}
}

