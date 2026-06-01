import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { PackageDto } from "@/features/admin/schemas/package.schema"
import { packageService } from "@/features/packages/services/package.service"
import toast from "react-hot-toast"

export function useModifyPackage() {
	const queryClient = useQueryClient()

	const { mutate: updatePackage, isPending: isLoading } = useMutation({
		mutationKey: ["modify-package"],
		mutationFn: ({ id, dto }: { id: string; dto: PackageDto }) =>
			packageService.modifyPackage(id, dto),
		onSuccess: () => {
			toast.success("Пакет успешно сохранён")
			queryClient.invalidateQueries({
				queryKey: ["packages"]
			})
		},
		onError: ({ message }) => toast.error(message)
	})

	return {
		updatePackage,
		isLoading
	}
}
