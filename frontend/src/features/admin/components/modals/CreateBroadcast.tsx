"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { FC } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

import { broadcastSchema, type CreateBroadcastDto, BROADCAST_SEGMENTS } from "@/features/admin/schemas/broadcast.schema"
import { useCreateBroadcast, useBroadcastAudience } from "@/features/admin/hooks/useBroadcasts"
import { SEGMENT_LABELS, type BroadcastSegment } from "@/features/admin/types/broadcast.types"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import Select from "@/shared/components/ui/Select"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

const fieldCls =
	"w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-white placeholder:text-white/40 outline-none transition-colors focus:border-[#0067ff]"

const CreateBroadcast: FC = () => {
	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors },
		setError,
		reset
	} = useForm<CreateBroadcastDto>({
		resolver: zodResolver(broadcastSchema),
		defaultValues: { title: "", body: "", link: "", segment: "all" }
	})
	const { createBroadcast, isLoading } = useCreateBroadcast()
	const { close } = useModalStore()

	const segment = watch("segment")
	const title = watch("title")
	const body = watch("body")
	const { count } = useBroadcastAudience(segment)

	const onSubmit = (dto: CreateBroadcastDto) => {
		createBroadcast(dto, {
			onSuccess: () => {
				reset()
				close()
				toast.success("Рассылка отправлена")
			},
			onError: ({ message }) => setError("root", { message })
		})
	}

	return (
		<form className="flex w-full max-w-[520px] flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
			<h2 className="text-body text-2xl font-semibold">Создание рассылки</h2>

			<div className="flex w-full flex-col gap-1">
				<span className="text-body/50 text-base font-medium">Заголовок</span>
				<Input placeholder="Например: Новые тарифы" error={errors.title?.message} {...register("title")} />
			</div>

			<div className="flex w-full flex-col gap-1">
				<span className="text-body/50 text-base font-medium">Текст</span>
				<textarea rows={4} className={fieldCls} placeholder="Текст уведомления…" {...register("body")} />
				{errors.body?.message && <span className="text-error text-sm">{errors.body.message}</span>}
			</div>

			<div className="flex w-full flex-col gap-1">
				<span className="text-body/50 text-base font-medium">Ссылка кнопки (опционально)</span>
				<Input placeholder="https://…" error={errors.link?.message} {...register("link")} />
			</div>

			<div className="flex w-full flex-col gap-1">
				<span className="text-body/50 text-base font-medium">Аудитория</span>
				<Select
					value={segment}
					onChange={v => setValue("segment", v as BroadcastSegment, { shouldValidate: true })}
					className="!w-full"
				>
					{BROADCAST_SEGMENTS.map(s => (
						<Select.Option key={s} value={s}>
							{SEGMENT_LABELS[s]}
						</Select.Option>
					))}
				</Select>
				<span className="text-body/40 text-xs">
					Получателей: {count ?? "…"}
				</span>
			</div>

			{/* Предпросмотр уведомления */}
			<div className="flex w-full flex-col gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
				<span className="text-body/40 text-xs font-medium uppercase tracking-wide">Предпросмотр</span>
				<p className="text-body text-sm font-semibold">{title || "Заголовок уведомления"}</p>
				<p className="text-body/60 text-xs">{body || "Текст уведомления появится здесь"}</p>
			</div>

			{errors.root?.message && <Footnote variant="error">{errors.root.message}</Footnote>}

			<Button variant="fill" type="submit" disabled={isLoading}>
				{isLoading ? <Loader /> : `Отправить${count ? ` (${count})` : ""}`}
			</Button>
		</form>
	)
}

export default CreateBroadcast
