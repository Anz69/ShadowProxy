import { zodResolver } from "@hookform/resolvers/zod"
import { type FC, useState } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

import {
	type PackageDto,
	packageSchema
} from "@/features/admin/schemas/package.schema"
import { useCreatePackage } from "@/features/packages/hooks/useCreatePackage"
import type { RechargeableProxyType } from "@/features/proxy/types/proxy.types"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import SegmentedControl from "@/shared/components/ui/SegmentedControl"

const typeLabels: Record<RechargeableProxyType, string> = {
	RESIDENT_PREMIUM: "Residential",
	PREMIUM_RESIDENTIAL: "Premium Residential",
	MOBILE: "Mobile",
	MOBILE_GB: "Mobile ГБ",
	IPV6_GB: "IPv6 ГБ",
	RESIDENT: "Резидентский" // не используется, оставлен для типа
}

const reverseTypeLabels = new Map<string, RechargeableProxyType>()
	.set("Residential", "RESIDENT_PREMIUM")
	.set("Premium Residential", "PREMIUM_RESIDENTIAL")
	.set("Mobile", "MOBILE")
	.set("Mobile ГБ", "MOBILE_GB")
	.set("IPv6 ГБ", "IPV6_GB")

type AddPackageProps = {
	initialType?: string
}

const AddPackage: FC<AddPackageProps> = ({ initialType }) => {
	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch,
		setError,
		reset
	} = useForm<PackageDto>({
		resolver: zodResolver(packageSchema),
		defaultValues: {
			type: (initialType as RechargeableProxyType) ?? "RESIDENT_PREMIUM",
			traffic: 1
		}
	})
	const { createPackage, isLoading } = useCreatePackage()
	const { close } = useModalStore()

	// Единица ввода трафика: ГБ (по умолчанию) или МБ. На бэк всегда уходит ГБ
	// (бэкенд конвертирует ГБ → байты), поэтому МБ делим на 1024.
	const [unit, setUnit] = useState<"ГБ" | "МБ">("ГБ")

	const onSubmit = (dto: PackageDto) => {
		const trafficGb = unit === "МБ" ? dto.traffic / 1024 : dto.traffic
		// Цена больше не хранится в пакете — берётся из тарификации.
		// Пакет = быстрый объём (пресет оплаты). Отправляем price: 0.
		createPackage({ ...dto, traffic: trafficGb, price: 0 }, {
			onSuccess: () => {
				reset()
				close()
				toast.success("Пакет успешно создан!")
			},
			onError: ({ message }) => setError("root", { message })
		})
	}

	return (
		<form
			className="flex w-full flex-col items-center gap-4"
			onSubmit={handleSubmit(onSubmit)}
		>
			<h2 className="text-body text-2xl font-semibold">
				Создание пакета
			</h2>
			<p className="text-body/40 w-full text-center text-xs">
				Пакет — это быстрый объём (пресет) на странице оплаты. Цена считается из тарификации.
			</p>
			<SegmentedControl
				options={["Residential", "Premium Residential", "Mobile", "Mobile ГБ", "IPv6 ГБ"]}
				value={typeLabels[watch("type") as RechargeableProxyType]}
				onChange={val => setValue("type", reverseTypeLabels.get(val) ?? "RESIDENT_PREMIUM")}
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
					error={errors.traffic?.message}
					{...register("traffic", {
						valueAsNumber: true
					})}
				/>
				<span className="text-body/40 text-xs">
					{unit === "МБ" ? "Напр. 100, 250, 500 МБ" : "Можно дробное, напр. 0.5 ГБ"}
				</span>
			</div>
			{errors.root?.message && (
				<Footnote variant="error">{errors.root.message}</Footnote>
			)}
			<Button variant="fill" type="submit" disabled={isLoading}>
				{isLoading ? <Loader /> : "Создать"}
			</Button>
		</form>
	)
}

export default AddPackage
