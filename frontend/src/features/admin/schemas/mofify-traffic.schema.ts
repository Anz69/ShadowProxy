import { z } from "zod"

const trafficAmount = z.number({ error: "Трафик должен быть числом" })
	.finite({ error: "Укажите корректное количество ГБ" })
	.min(0, { error: "Трафик не может быть меньше 0" })

export const modifyTrafficSchema = z.object({
	premiumTrafficLeft: trafficAmount.optional(),
	premiumResidentialTrafficLeft: trafficAmount.optional(),
	ispUsaTrafficLeft: trafficAmount.optional(),
	residentialLiteTrafficLeft: trafficAmount.optional(),
	mobileGbTrafficLeft: trafficAmount.optional(),
	mobileTrafficLeft: trafficAmount.optional()
})

export type ModifyTrafficDto = z.infer<typeof modifyTrafficSchema>
