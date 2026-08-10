import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { userService } from "@/features/user/services/user.service"
import type { AdminUsersParams } from "@/features/user/types/user.types"

/**
 * Админ-список пользователей: серверная пагинация/поиск/сортировка.
 * keepPreviousData — чтобы таблица не мигала при смене страницы/поиске.
 */
export function useGetAllUsers(params: AdminUsersParams) {
	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["admin-users", params],
		queryFn: () => userService.getAll(params),
		placeholderData: keepPreviousData
	})

	return {
		users: data?.users,
		total: data?.total ?? 0,
		isLoading,
		isFetching
	}
}
