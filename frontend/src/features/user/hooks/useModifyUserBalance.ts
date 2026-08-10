import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { ModifyBalanceDto } from "@/features/admin/schemas/modify-balance.schema"
import { userService } from "@/features/user/services/user.service"

export function useModifyUserBalance() {
	const queryClient = useQueryClient()

	const { mutate: modifyBalance, isPending: isLoading } = useMutation({
		mutationKey: ["modify-user-balance"],
		mutationFn: ({ id, dto }: { id: string; dto: ModifyBalanceDto }) =>
			userService.modifyBalance(id, dto),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["admin-users"]
			})
		}
	})

	return {
		modifyBalance,
		isLoading
	}
}
