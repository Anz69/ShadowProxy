import { z } from "zod"

import type {
	AvailableAssets,
	Merchant,
	ResidentTariff
} from "@/features/payments/types/payment.types"

export const orderResidentSchema = z.object({
	traffic: z
		.number({
			error: "Трафик должен быть числом"
		})
		.min(0.1, {
			error: "Минимум 100 МБ"
		})
})

export type OrderResidentDto = z.infer<typeof orderResidentSchema> & {
	tariff: ResidentTariff
	asset: AvailableAssets
	merchant: Merchant
}
