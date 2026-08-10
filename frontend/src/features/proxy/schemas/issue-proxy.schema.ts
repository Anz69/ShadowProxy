import { z } from "zod"

export const issueProxySchema = z.object({
	quantity: z
		.int({
			error: "Должно быть числом"
		})
		.min(1, {
			error: "Не может быть меньше 1"
		})
		.max(500, {
			error: "Не может быть больше 500"
		})
})

export type IssueProxyDto = z.infer<typeof issueProxySchema>
