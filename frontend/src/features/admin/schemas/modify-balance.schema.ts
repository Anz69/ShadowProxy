import { z } from "zod"

export const modifyBalanceSchema = z.object({
	balance: z.number().min(0, "Баланс не может быть отрицательным")
})

export type ModifyBalanceDto = z.infer<typeof modifyBalanceSchema>
