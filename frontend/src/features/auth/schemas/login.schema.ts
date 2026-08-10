import { z } from "zod"

export const loginSchema = z.object({
	email: z.email({
		error: "validation.invalidEmail"
	}),
	password: z.string().min(6, {
		error: "validation.passwordMinLength"
	}),
})

export type LoginDto = z.infer<typeof loginSchema>