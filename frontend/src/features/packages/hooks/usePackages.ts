import { useQuery } from "@tanstack/react-query"
import { packageService } from "@/features/packages/services/package.service"

export function usePackages() {
	const {data: packages, isLoading} = useQuery({
		queryKey: ["packages"],
		queryFn: () => packageService.getAll()
	})

	return {
		packages,
		isLoading
	}
}