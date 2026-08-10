import { z } from "zod"

export const requestPasswordResetSchema = z.object({
	email: z.email({
		error: "validation.invalidEmail"
	})
})

export type RequestPasswordResetDto = z.infer<
	typeof requestPasswordResetSchema
>

export const resetPasswordSchema = z
	.object({
		password: z.string().min(6, {
			error: "validation.passwordMinLength"
		}),
		passwordRepeat: z.string().min(6, {
			error: "validation.passwordMinLength"
		})
	})
	.refine(data => data.password === data.passwordRepeat, {
		error: "validation.passwordsMismatch",
		path: ["passwordRepeat"]
	})

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>
