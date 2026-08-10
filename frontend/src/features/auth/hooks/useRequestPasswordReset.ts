import { useMutation } from "@tanstack/react-query"

import type { RequestPasswordResetDto } from "@/features/auth/schemas/password-recovery.schema"
import { passwordResetService } from "@/features/auth/services/password-reset.service"

export function useRequestPasswordReset() {

	const { mutate: resetPassword, isPending: isLoading } = useMutation({
		mutationKey: ["user password-reset"],
		mutationFn: ({
			dto,
			recaptcha
		}: {
			dto: RequestPasswordResetDto
			recaptcha?: string
		}) => passwordResetService.requestPasswordReset(dto, recaptcha),
	})

	return {
		resetPassword,
		isLoading
	}
}
