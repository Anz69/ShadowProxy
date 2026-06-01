import { z } from "zod"

import type {
	AvailableAssets,
	Merchant
} from "@/features/payments/types/payment.types"

export const orderIspSchema = z.object({
	quantity: z
		.number({
			error: "Количество должно быть числом"
		})
		.min(1, {
			error: "Нельзя купить меньше 1 IP"
		})
})

export type OrderIspDto = z.infer<typeof orderIspSchema> & {
	asset: AvailableAssets
	merchant: Merchant
}
