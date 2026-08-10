import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { ModifyTrafficDto } from "@/features/admin/schemas/mofify-traffic.schema"
import { userService } from "@/features/user/services/user.service"

export function useModifyUserTraffic() {
	const queryClient = useQueryClient()

	const { mutate: modifyTraffic, isPending: isLoading } = useMutation({
		mutationKey: ["modify-user-traffic"],
		mutationFn: ({ id, dto }: { id: string; dto: ModifyTrafficDto }) =>
			userService.modifyTraffic(id, dto),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["admin-users"]
			})
		}
	})

	return {
		modifyTraffic,
		isLoading
	}
}
