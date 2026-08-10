import { z } from "zod"

export const modifyTrafficSchema = z.object({
	premiumTrafficLeft: z
		.number({
			error: "Трафик должен быть числом"
		})
		.min(0, {
			error: "Трафик не может быть меньше 0"
		}),
	mobileGbTrafficLeft: z
		.number({
			error: "Трафик должен быть числом"
		})
		.min(0, {
			error: "Трафик не может быть меньше 0"
		}),
	ipv6GbTrafficLeft: z
		.number({
			error: "Трафик должен быть числом"
		})
		.min(0, {
			error: "Трафик не может быть меньше 0"
		}),
	premiumResidentialTrafficLeft: z
		.number({
			error: "Трафик должен быть числом"
		})
		.min(0, {
			error: "Трафик не может быть меньше 0"
		})
		.optional(),
	mobileTrafficLeft: z
		.number({
			error: "Трафик должен быть числом"
		})
		.min(0, {
			error: "Трафик не может быть меньше 0"
		})
		.optional()
})

export type ModifyTrafficDto = z.infer<typeof modifyTrafficSchema>
