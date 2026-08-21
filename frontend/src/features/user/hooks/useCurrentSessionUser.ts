import { useQuery } from "@tanstack/react-query"

import { userService } from "@/features/user/services/user.service"
import type { User } from "@/features/user/types/user.types"

/**
 * Синхронизирует persistent app shell с реальной серверной сессией.
 * Server Component даёт мгновенное initialUser, а браузер перепроверяет роль:
 * это защищает Header от временной ошибки SSR и устаревшего layout при перелогине.
 */
export function useCurrentSessionUser(initialUser?: User | null) {
	return useQuery({
		queryKey: ["current-session-user"],
		queryFn: () => userService.getCurrentSessionUser(),
		initialData: initialUser ?? undefined,
		staleTime: 0,
		refetchOnMount: "always",
		refetchOnWindowFocus: "always",
		refetchOnReconnect: "always",
		retry: 3,
		retryDelay: attempt => Math.min(500 * 2 ** attempt, 4000)
	})
}
