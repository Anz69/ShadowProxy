import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/shared/api/api.client"

export type ActiveDiscount = { kind: "trial" | "review"; pct: number } | null

export function useActiveDiscount(enabled = true) {
	return useQuery({
		queryKey: ["active-discount"],
		queryFn: async (): Promise<ActiveDiscount> => {
			try {
				const res = await apiClient.get<ActiveDiscount>("/payments/active-discount")
				return res.data ?? null
			} catch {
				return null
			}
		},
		enabled
	})
}
