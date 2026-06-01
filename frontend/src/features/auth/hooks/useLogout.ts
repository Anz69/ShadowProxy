import { useMutation } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"

import { authService } from "@/features/auth/services/auth.service"

export function useLogout() {
	const router = useRouter()
	const pathname = usePathname()

	const { mutate: logout, isPending: isLoading } = useMutation({
		mutationKey: ["logout"],
		mutationFn: () => authService.logout(),
		onSuccess: () => {
			const localizedPath = getLocalizedPath(pathname, "/auth/login")
			router.push(localizedPath)
		}
	})

	return {
		logout,
		isLoading
	}
}
