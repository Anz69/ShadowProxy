import { zodResolver } from "@hookform/resolvers/zod"
import { Download } from "lucide-react"
import { type FC, useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { useCreateKey } from "@/features/keys/hooks/useCreateKey"
import {
	type CreateKeyDto,
	createKeySchema
} from "@/features/keys/schemas/create-key.schema"
import type { Key } from "@/features/keys/types/keys.types"
import type { RechargeableProxyType } from "@/features/proxy/types/proxy.types"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import SegmentedControl from "@/shared/components/ui/SegmentedControl"
import { downloadAsFile } from "@/shared/utils/download-as-file"

const typeLabels: Record<string, string> = {
	RESIDENT_PREMIUM: "Residential Proxy",
	PREMIUM_RESIDENTIAL: "Premium Residential",
	MOBILE: "Mobile",
	MOBILE_GB: "Mobile GB",
	IPV6_GB: "IPv6 ГБ"
}

const reverseTypeLabels = new Map<string, string>()
	.set("Residential Proxy", "RESIDENT_PREMIUM")
	.set("Premium Residential", "PREMIUM_RESIDENTIAL")
	.set("Mobile", "MOBILE")
	.set("Mobile GB", "MOBILE_GB")
	.set("IPv6 ГБ", "IPV6_GB")

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
			tariff: "RESIDENT_PREMIUM",
			contents: 1,
			quantity: 1
		}
	})
	const { createKey, isLoading, createdKeys } = useCreateKey()
	const [lastCreatedRes, setLastCreatedRes] = useState<Key[]>([])
	// Единица ввода трафика: ГБ или МБ. На бэк уходит ГБ (МБ ÷ 1024).
	const [unit, setUnit] = useState<"ГБ" | "МБ">("ГБ")

	const onSubmit = (dto: CreateKeyDto) => {
		setLastCreatedRes([])
		const contentsGb = unit === "МБ" ? dto.contents / 1024 : dto.contents
		createKey({ ...dto, contents: contentsGb }, {
			onError: ({ message }) => setError("root", { message }),
			onSuccess: () => {
				reset()
			}
		})
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
				<SegmentedControl
					options={["Residential Proxy", "Premium Residential", "Mobile", "Mobile GB", "IPv6 ГБ"]}
					value={typeLabels[watch("tariff")] ?? "Residential Proxy"}
					onChange={val => setValue("tariff", (reverseTypeLabels.get(val) ?? "RESIDENT_PREMIUM") as RechargeableProxyType)}
				/>
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
										unit === u ? "bg-[#0066FF] text-white" : "text-body/60 hover:text-white"
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
						{unit === "МБ" ? "Напр. 100, 250, 500 МБ" : "Можно дробное, напр. 0.5 ГБ"}
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
								lastCreatedRes.map(el => el.key.toUpperCase()).join("\n"),
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
