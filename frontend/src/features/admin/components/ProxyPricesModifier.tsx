"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { BadgeDollarSign, CheckCircle2, Save, ShieldCheck } from "lucide-react"
import { type FC } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

import { useModifyPrices } from "@/features/admin/hooks/useModifyPrices"
import {
	type ModifyPricesDto,
	modifyPricesSchema
} from "@/features/admin/schemas/modify-prices.schema"
import type { Prices } from "@/features/proxy/types/proxy.types"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"

type ProxyPricesModifierProps = {
	prices: Prices
}

const ProxyPricesModifier: FC<ProxyPricesModifierProps> = ({ prices }) => {
	const {
		register,
		handleSubmit,
		formState: { errors },
		setError
	} = useForm<ModifyPricesDto>({
		resolver: zodResolver(modifyPricesSchema),
		defaultValues: {
			resident_premium: prices.resident_premium,
			mobile_gb: prices.mobile_gb,
			ipv6_gb: prices.ipv6_gb,
			premium_residential: prices.premium_residential,
			isp_usa: prices.isp_usa ?? 1.5,
			isp_eu: prices.isp_eu ?? 1.5,
			residential_lite: prices.residential_lite ?? 0.9,
			mobile: prices.mobile_legacy_options ?? []
		}
	})

	const { modifyPrices, isLoading } = useModifyPrices()

	const onSubmit = (dto: ModifyPricesDto) => {
		modifyPrices(dto, {
			onSuccess: () => {
				toast.success("Цены успешно сохранены")
			},
			onError: ({ message }) => setError("root", { message })
		})
	}

	const fields = [
		{ name: "resident_premium" as const, label: "Residential Proxy", hint: "Основной residential-тариф", premium: false },
		{ name: "premium_residential" as const, label: "Premium Residential", hint: "Премиальный residential-пул", premium: true },
		{ name: "mobile_gb" as const, label: "Premium Mobile", hint: "Мобильные 4G/5G по трафику", premium: true },
		{ name: "isp_eu" as const, label: "ISP Netherlands", hint: "Единственное доступное ISP-гео — NL", premium: false },
		{ name: "residential_lite" as const, label: "Residential Lite", hint: "Доступный residential-тариф", premium: false },
		{ name: "ipv6_gb" as const, label: "IPv6 GB", hint: "Legacy-тариф IPv6", premium: false },
		{ name: "isp_usa" as const, label: "ISP USA (legacy)", hint: "Продажа закрыта, цена сохранена для старых пакетов", premium: false }
	]

	return (
		<form className="w-full" onSubmit={handleSubmit(onSubmit)}>
			<Card className="!gap-6 overflow-hidden !rounded-[22px] !border-white/[0.09] !bg-[linear-gradient(145deg,rgba(17,31,62,.96),rgba(8,15,31,.98))] !p-5 sm:!p-7">
				<div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<span className="grid size-11 place-items-center rounded-[14px] border border-[#6aa5ff]/25 bg-[#2f6bff]/10 text-[#6aa5ff]"><BadgeDollarSign className="size-5" /></span>
						<div><h1 className="font-[TalosDisplay] text-2xl font-semibold text-white">Тарификация</h1><p className="mt-1 text-sm text-white/45">Базовая стоимость за 1 ГБ для всех типов прокси</p></div>
					</div>
					<span className="inline-flex items-center gap-2 self-start rounded-full border border-[#34d399]/20 bg-[#34d399]/10 px-3 py-1.5 text-xs font-medium text-[#66e0ac]"><CheckCircle2 className="size-3.5" />Изменения применяются сразу</span>
				</div>

				<div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
					{fields.map(field => (
						<label key={field.name} className="group flex min-w-0 flex-col gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-4 transition-colors hover:border-[#6aa5ff]/25 hover:bg-white/[0.04]">
							<span className="flex items-start justify-between gap-3"><span><span className="block text-[15px] font-semibold text-white">{field.label}</span><span className="mt-1 block text-xs leading-5 text-white/40">{field.hint}</span></span>{field.premium && <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#6aa5ff]" />}</span>
							<Input type="number" min="0.001" step="0.001" rightLabel="$ / GB" error={errors[field.name]?.message} {...register(field.name, { valueAsNumber: true })} />
						</label>
					))}
				</div>
				{errors.root?.message && (
					<Footnote variant="error">{errors.root.message}</Footnote>
				)}
				<Button variant="fill" type="submit" disabled={isLoading} className="w-full sm:w-auto sm:self-end">
					{isLoading ? <Loader /> : <span className="inline-flex items-center gap-2"><Save className="size-4" />Сохранить цены</span>}
				</Button>
			</Card>
		</form>
	)
}

export default ProxyPricesModifier
