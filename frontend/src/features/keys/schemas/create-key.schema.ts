import { z } from "zod"

export const createKeySchema = z.object({
	tariff: z.string({
		error: "Должно быть строкой"
	}),
	contents: z
		.number({
			error: "Должно быть числом"
		})
		.positive({
			error: "Должно быть больше 0"
		}),
	quantity: z
		.number({
			error: "Должно быть числом"
		})
		.min(1, {
			error: "Не может быть меньше 1"
		})
}).refine(data => ["RESIDENT_PREMIUM", "PREMIUM_RESIDENTIAL", "MOBILE", "MOBILE_GB", "IPV6_GB"].includes(data.tariff), {
	error: "Неверный тариф",
	path: ["tariff"]
})

export type CreateKeyDto = z.infer<typeof createKeySchema>