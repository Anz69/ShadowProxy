import { z } from "zod"

export const modifyPricesSchema = z.object({
	resident_premium: z
		.number({
			error: "Должно быть число"
		})
		.positive({
			error: "Должно быть позитивным числом"
		}),
	mobile_gb: z
		.number({
			error: "Должно быть число"
		})
		.positive({
			error: "Должно быть позитивным числом"
		}),
	ipv6_gb: z
		.number({
			error: "Должно быть число"
		})
		.positive({
			error: "Должно быть позитивным числом"
		}),
	premium_residential: z
		.number({
			error: "Должно быть число"
		})
		.positive({
			error: "Должно быть позитивным числом"
		})
		.optional(),
	mobile: z.array(
		z.object({
			price: z
				.number({
					error: "Должно быть число"
				})
				.positive({
					error: "Должно быть позитивным числом"
				}),
			rentTime: z
				.number({
					error: "Должно быть число"
				})
				.positive({
					error: "Должно быть позитивным числом"
				})
		})
	)
})

export type ModifyPricesDto = z.infer<typeof modifyPricesSchema>
