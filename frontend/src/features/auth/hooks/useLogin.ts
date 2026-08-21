import { useMutation } from "@tanstack/react-query"
import { usePathname } from "next/navigation"

import type { LoginDto } from "@/features/auth/schemas/login.schema"
import { authService } from "@/features/auth/services/auth.service"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"

export function useLogin() {
	const pathname = usePathname()

	const { mutate: login, isPending: isLoading } = useMutation({
		mutationKey: ["user login"],
		mutationFn: ({
			dto,
			recaptcha
		}: {
			dto: LoginDto
			recaptcha?: string
		}) => authService.login(dto, recaptcha),
		onSuccess: () => {
			const localizedPath = getLocalizedPath(pathname, "/dashboard")
			// После установки session-cookie нужен новый document request. SPA-переход
			// может восстановить prefetched/cached app-layout, полученный до авторизации,
			// и Header временно увидит null/старую роль (пропадала кнопка админки).
			window.location.assign(localizedPath)
		}
	})

	return {
		login,
		isLoading
	}
}
