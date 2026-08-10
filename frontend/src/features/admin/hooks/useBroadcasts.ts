import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { adminService } from "@/features/admin/serices/admin.service"
import type { CreateBroadcastDto } from "@/features/admin/schemas/broadcast.schema"
import type { BroadcastSegment } from "@/features/admin/types/broadcast.types"

export function useBroadcasts(page = 1) {
	const { data, isLoading } = useQuery({
		queryKey: ["admin-broadcasts", page],
		queryFn: () => adminService.listBroadcasts(page)
	})
	return { broadcasts: data?.items ?? [], total: data?.total ?? 0, isLoading }
}

export function useCreateBroadcast() {
	const qc = useQueryClient()
	const { mutate: createBroadcast, isPending: isLoading } = useMutation({
		mutationKey: ["create-broadcast"],
		mutationFn: (dto: CreateBroadcastDto) => adminService.createBroadcast(dto),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-broadcasts"] })
	})
	return { createBroadcast, isLoading }
}

export function useBroadcastAudience(segment: BroadcastSegment) {
	const { data } = useQuery({
		queryKey: ["admin-broadcast-audience", segment],
		queryFn: () => adminService.broadcastAudience(segment)
	})
	return { count: data?.count }
}
