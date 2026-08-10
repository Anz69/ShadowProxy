import { useMutation } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"

import type { ResetPasswordDto } from "@/features/auth/schemas/password-recovery.schema"
import { passwordResetService } from "@/features/auth/services/password-reset.service"

export function useResetPassword() {
	const router = useRouter()
	const pathname = usePathname()

	const { mutate: resetPassword, isPending: isLoading } = useMutation({
		mutationKey: ["user password-reset"],
		mutationFn: (dto: ResetPasswordDto & {token: string}) =>
			passwordResetService.resetPassword(dto),
		onSuccess: async () => {
			const localizedPath = getLocalizedPath(pathname, "/dashboard")
			await router.push(localizedPath)
		}
	})

	return {
		resetPassword,
		isLoading
	}
}
