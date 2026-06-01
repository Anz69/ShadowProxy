import { z } from "zod"

export const packageSchema = z.object({
	type: z.string({
		error: "Тип должен быть строкой"
	}),
	traffic: z
		.number({
			error: "Трафик должен быть числом"
		})
		.positive({
			error: "Трафик должен быть позитивным числом"
		}),
	// Цена больше не задаётся в пакете (берётся из тарификации).
	// Поле опционально для обратной совместимости со старыми пакетами.
	price: z
		.number({
			error: "Цена должна быть числом"
		})
		.optional()
})

export type PackageDto = z.infer<typeof packageSchema>
