import { z } from "zod"

export const modifyProxySchema = z
	.object({
		proxies: z.array(z.string()),
		rotation: z.enum(["AUTO", "BY_TIME", ""], {
			error: "Неизвестный тип ротации"
		}).optional(),
		rotationInterval: z.number({
			error: "Должно быть числом"
		}).min(5, {
			error: "Не может быть меньше 5"
		}).max(90, {
			error: "Не может быть больше 90"
		}).optional(),
		location: z.string({
			error: "Неизвестная страна"
		}).optional()
	})
	.refine(
		data =>
			data.rotation !== "BY_TIME" || data.rotationInterval !== undefined,
		{
			message: "Укажите интервал ротации!",
			path: ["rotationInterval"]
		}
	)
	.refine(data => data.rotation || data.rotationInterval || data.location, {
		message: "Должно быть заполнено хотя бы одно поле"
	})

export type ModifyProxyDto = z.infer<typeof modifyProxySchema>
