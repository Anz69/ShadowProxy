import { useMutation } from "@tanstack/react-query"

import type { RegisterDto } from "@/features/auth/schemas/register.schema"
import { authService } from "@/features/auth/services/auth.service"

export function useRegister() {

	const { mutate: registerUser, isPending: isLoading } = useMutation({
		mutationKey: ["user register"],
		mutationFn: ({
			dto,
			recaptcha
		}: {
			dto: RegisterDto
			recaptcha?: string
		}) => authService.register(dto, recaptcha),
	})

	return {
		registerUser,
		isLoading
	}
}
