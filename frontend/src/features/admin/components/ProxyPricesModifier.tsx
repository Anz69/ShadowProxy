"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2 } from "lucide-react"
import { type FC } from "react"
import { useFieldArray, useForm } from "react-hook-form"
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
		control,
		setError
	} = useForm<ModifyPricesDto>({
		resolver: zodResolver(modifyPricesSchema),
		defaultValues: {
			resident_premium: prices.resident_premium,
			mobile_gb: prices.mobile_gb,
			ipv6_gb: prices.ipv6_gb,
			premium_residential: prices.premium_residential,
			mobile: prices.mobile_legacy_options ?? []
		}
	})

	const { fields, append, remove } = useFieldArray({
		control,
		name: "mobile"
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

	return (
		<form className="w-full" onSubmit={handleSubmit(onSubmit)}>
			<Card>
				<h1 className="text-body w-full text-3xl font-semibold">
					Цены
				</h1>
				<div className="grid w-full grid-cols-2 gap-x-4 gap-y-2">
					<div className="flex w-full flex-col">
						<span className="text-body/50 text-lg font-medium">
							Премиум прокси (за Гб)
						</span>
						<Input
							type="number"
							step="0.001"
							rightLabel="$"
							error={errors.resident_premium?.message}
							{...register("resident_premium", {
								valueAsNumber: true
							})}
						/>
					</div>
					<div className="flex w-full flex-col">
						<span className="text-body/50 text-lg font-medium">
							Mobile ГБ (за Гб)
						</span>
						<Input
							type="number"
							step="0.001"
							rightLabel="$"
							error={errors.mobile_gb?.message}
							{...register("mobile_gb", {
								valueAsNumber: true
							})}
						/>
					</div>
					<div className="flex w-full flex-col">
						<span className="text-body/50 text-lg font-medium">
							IPv6 ГБ (за Гб)
						</span>
						<Input
							type="number"
							step="0.001"
							rightLabel="$"
							error={errors.ipv6_gb?.message}
							{...register("ipv6_gb", {
								valueAsNumber: true
							})}
						/>
					</div>
					<div className="flex w-full flex-col">
						<span className="text-body/50 text-lg font-medium">
							Premium Residential (за Гб)
						</span>
						<Input
							type="number"
							step="0.001"
							rightLabel="$"
							error={errors.premium_residential?.message}
							{...register("premium_residential", {
								valueAsNumber: true
							})}
						/>
					</div>
				</div>

				<div className="flex w-full flex-col gap-4">
					<span className="text-body/50 -mb-4 text-lg font-medium">
						Legacy Mobile (time-based, не используется для новых покупок)
					</span>
					{fields.map((field, index) => (
						<div key={field.id} className="flex w-full gap-4">
							<Input
								type="number"
								step="0.01"
								rightLabel="$"
								error={errors.mobile?.[index]?.price?.message}
								{...register(`mobile.${index}.price`, {
									valueAsNumber: true
								})}
							/>
							<Input
								type="number"
								step="1"
								rightLabel="c"
								error={
									errors.mobile?.[index]?.rentTime?.message
								}
								{...register(`mobile.${index}.rentTime`, {
									valueAsNumber: true
								})}
							/>
							<button
								type="button"
								onClick={() => remove(index)}
								className="text-error cursor-pointer duration-200 hover:brightness-75"
							>
								<Trash2 className="size-5" />
							</button>
						</div>
					))}
					<Button
						variant="outline"
						type="button"
						onClick={() => append({ price: 1, rentTime: 1 })}
					>
						Добавить тариф
					</Button>
				</div>
				{errors.root?.message && (
					<Footnote variant="error">{errors.root.message}</Footnote>
				)}
				<Button variant="fill" type="submit" disabled={isLoading}>
					{isLoading ? <Loader /> : "Сохранить"}
				</Button>
			</Card>
		</form>
	)
}

export default ProxyPricesModifier
