import { z } from "zod"

import { ACTIVE_KEY_TARIFFS } from "@/features/keys/constants/key-tariffs"

export const createKeySchema = z.object({
	tariff: z.enum(ACTIVE_KEY_TARIFFS),
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
})

export type CreateKeyDto = z.infer<typeof createKeySchema>
