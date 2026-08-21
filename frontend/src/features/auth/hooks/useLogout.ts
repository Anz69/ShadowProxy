import { useMutation } from "@tanstack/react-query"
import { usePathname } from "next/navigation"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"

import { authService } from "@/features/auth/services/auth.service"

export function useLogout() {
	const pathname = usePathname()

	const { mutate: logout, isPending: isLoading } = useMutation({
		mutationKey: ["logout"],
		mutationFn: () => authService.logout(),
		onSuccess: () => {
			const localizedPath = getLocalizedPath(pathname, "/auth/login")
			// Полный переход очищает persistent layout с данными прошлого пользователя.
			window.location.assign(localizedPath)
		}
	})

	return {
		logout,
		isLoading
	}
}
