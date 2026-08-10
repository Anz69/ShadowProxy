import { z } from "zod"

export const BROADCAST_SEGMENTS = ["all", "trial_active", "after_purchase", "no_purchases"] as const

export const broadcastSchema = z.object({
	title: z.string().min(1, "Заголовок обязателен").max(200),
	body: z.string().min(1, "Текст обязателен").max(2000),
	link: z.string().url("Некорректная ссылка").optional().or(z.literal("")),
	segment: z.enum(BROADCAST_SEGMENTS)
})

export type CreateBroadcastDto = z.infer<typeof broadcastSchema>
