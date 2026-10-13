import { zodResolver } from "@hookform/resolvers/zod"
import { Download } from "lucide-react"
import { type FC, useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import {
	ACTIVE_KEY_TARIFFS,
	KEY_TARIFF_LABELS
} from "@/features/keys/constants/key-tariffs"
import { useCreateKey } from "@/features/keys/hooks/useCreateKey"
import {
	type CreateKeyDto,
	createKeySchema
} from "@/features/keys/schemas/create-key.schema"
import type { Key } from "@/features/keys/types/keys.types"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import { downloadAsFile } from "@/shared/utils/download-as-file"

const CreateKey: FC = () => {
	const {
		register,
		handleSubmit,
		setError,
		setValue,
		formState: { errors },
		reset,
		watch
	} = useForm<CreateKeyDto>({
		resolver: zodResolver(createKeySchema),
		defaultValues: {
			tariff: ACTIVE_KEY_TARIFFS[0],
			contents: 1,
			quantity: 1
		}
	})
	const { createKey, isLoading, createdKeys } = useCreateKey()
	const [lastCreatedRes, setLastCreatedRes] = useState<Key[]>([])
	// Единица ввода трафика: ГБ или МБ. На бэк уходит ГБ (МБ ÷ 1024).
	const [unit, setUnit] = useState<"ГБ" | "МБ">("ГБ")
	const selectedTariff = watch("tariff")

	const onSubmit = (dto: CreateKeyDto) => {
		setLastCreatedRes([])
		const contentsGb = unit === "МБ" ? dto.contents / 1024 : dto.contents
		createKey(
			{ ...dto, contents: contentsGb },
			{
				onError: ({ message }) => setError("root", { message }),
				onSuccess: () => {
					reset()
				}
			}
		)
	}

	useEffect(() => {
		if (createdKeys && createdKeys.length) setLastCreatedRes(createdKeys)
	}, [createdKeys])

	return (
		<form className="w-full" onSubmit={handleSubmit(onSubmit)}>
			<Card className="w-full">
				<h1 className="text-body w-full text-3xl font-semibold">
					Создать ключ
				</h1>
				<div className="flex w-full flex-col gap-2">
					<span className="text-body/50 text-base font-medium">
						Тариф ключа
					</span>
					<div
						className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3"
						role="group"
						aria-label="Тариф ключа"
					>
						{ACTIVE_KEY_TARIFFS.map(tariff => {
							const selected = selectedTariff === tariff

							return (
								<button
									key={tariff}
									type="button"
									aria-pressed={selected}
									onClick={() =>
										setValue("tariff", tariff, {
											shouldDirty: true,
											shouldValidate: true
										})
									}
									className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-center text-sm leading-tight font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066FF] ${
										selected
											? "border-[#0066FF] bg-[#0066FF] text-white shadow-[0_4px_16px_rgba(0,102,255,0.2)]"
											: "border-body/15 bg-card/50 text-body/75 hover:bg-card hover:border-[#0066FF]/60"
									}`}
								>
									{KEY_TARIFF_LABELS[tariff]}
								</button>
							)
						})}
					</div>
				</div>
				<div className="flex w-full flex-col gap-1">
					<div className="flex w-full items-center justify-between">
						<span className="text-body/50 text-base font-medium">
							Трафик
						</span>
						<div className="flex items-center rounded-lg border border-white/15 p-0.5">
							{(["МБ", "ГБ"] as const).map(u => (
								<button
									key={u}
									type="button"
									onClick={() => setUnit(u)}
									className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
										unit === u
											? "bg-[#0066FF] text-white"
											: "text-body/60 hover:text-white"
									}`}
								>
									{u}
								</button>
							))}
						</div>
					</div>
					<Input
						type="number"
						step={unit === "МБ" ? 1 : 0.01}
						min={0}
						rightLabel={unit}
						error={errors.contents?.message}
						{...register("contents", {
							valueAsNumber: true
						})}
					/>
					<span className="text-body/40 text-xs">
						{unit === "МБ"
							? "Напр. 100, 250, 500 МБ"
							: "Можно дробное, напр. 0.5 ГБ"}
					</span>
				</div>
				<div className="flex w-full flex-col gap-1">
					<span className="text-body/50 text-base font-medium">
						Количество ключей
					</span>
					<Input
						error={errors.contents?.message}
						{...register("quantity", {
							valueAsNumber: true
						})}
					/>
				</div>
				{errors.root?.message && (
					<Footnote variant="error">{errors.root.message}</Footnote>
				)}
				<Button variant="fill" type="submit" disabled={isLoading}>
					{isLoading ? <Loader /> : "Создать"}
				</Button>
				{!!lastCreatedRes.length && (
					<Button
						variant="outline"
						type="button"
						onClick={() =>
							downloadAsFile(
								lastCreatedRes
									.map(el => el.key.toUpperCase())
									.join("\n"),
								`keys_${Date.now()}.txt`
							)
						}
					>
						Скачать созданные ключи <Download className="size-4" />
					</Button>
				)}
			</Card>
		</form>
	)
}

export default CreateKey
