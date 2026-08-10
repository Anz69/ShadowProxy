import { useQuery } from "@tanstack/react-query"
import { packageService } from "@/features/packages/services/package.service"
import type { UserPackage } from "../types/user-package.types"

export function useMyPackages() {
	const { data: userPackages, isLoading } = useQuery<UserPackage[]>({
		queryKey: ["user-packages"],
		queryFn: () => packageService.getMyPackages()
	})

	return {
		userPackages,
		isLoading
	}
}

