import { useMutation } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"

import type { LoginDto } from "@/features/auth/schemas/login.schema"
import { authService } from "@/features/auth/services/auth.service"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"

export function useLogin() {
	const router = useRouter()
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
		onSuccess: async (data) => {
			console.log("useLogin onSuccess:", data)
			const localizedPath = getLocalizedPath(pathname, "/dashboard")
			await router.push(localizedPath)
		},
		onError: (error) => {
			console.log("useLogin onError:", error)
		}
	})

	return {
		login,
		isLoading
	}
}
