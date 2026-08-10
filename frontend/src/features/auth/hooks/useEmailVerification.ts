import { useMutation } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"

import { verificationService } from "@/features/auth/services/verification.service"

export function useEmailVerification() {
	const router = useRouter()
	const pathname = usePathname()

	const { mutate: verify, isPending } = useMutation({
		mutationKey: ["user verification"],
		mutationFn: (token: string | null) => verificationService.verify(token),
		onSuccess: async () => {
			const localizedPath = getLocalizedPath(pathname, "/dashboard")
			await router.push(localizedPath)
		},
		onError: async () => {
			const localizedPath = getLocalizedPath(pathname, "/auth/login")
			await router.push(localizedPath)
		}
	})

	return {
		verify,
		isPending
	}
}
