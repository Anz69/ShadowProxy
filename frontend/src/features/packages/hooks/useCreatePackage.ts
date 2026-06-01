import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { PackageDto } from "@/features/admin/schemas/package.schema"
import { packageService } from "@/features/packages/services/package.service"

export function useCreatePackage() {
	const queryClient = useQueryClient()

	const { mutate: createPackage, isPending: isLoading } = useMutation({
		mutationKey: ["created-package"],
		mutationFn: (dto: PackageDto) => packageService.createPackage(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["packages"]
			})
		}
	})

	return {
		createPackage,
		isLoading
	}
}
