import { z } from "zod"

export const registerSchema = z.object({
	email: z.email({
		error: "validation.invalidEmail"
	}),
	password: z.string().min(6, {
		error: "validation.passwordMinLength"
	}),
	passwordRepeat: z.string().min(6, {
		error: "validation.passwordMinLength"
	}),
	referrerId: z.string().optional()
}).refine(data => data.password === data.passwordRepeat, {
	error: "validation.passwordsMismatch",
	path: ["passwordRepeat"]
})

export type RegisterDto = z.infer<typeof registerSchema>