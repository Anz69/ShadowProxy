import { useMutation } from "@tanstack/react-query"
import { packageService } from "../services/package.service"

export function useGeneratePackageProxy() {
	return useMutation({
		mutationFn: ({ packageId, location, rotation, quantity, rotationInterval, region, city, isp }: {
			packageId: string
			location: string
			rotation?: "BY_REQUEST" | "BY_TIME"
			quantity?: number
			rotationInterval?: number
			region?: string
			city?: string
			isp?: string
		}) =>
			packageService.generatePackageProxy(packageId, { location, rotation, quantity, rotationInterval, region, city, isp })
	})
}

