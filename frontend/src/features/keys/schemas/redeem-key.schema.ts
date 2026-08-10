import { z } from "zod"

export const redeemKeySchema = z.object({
	key: z.uuidv4({
		error: "Некорректный формат ключа"
	})
})

export type RedeemKeyDto = z.infer<typeof redeemKeySchema>
