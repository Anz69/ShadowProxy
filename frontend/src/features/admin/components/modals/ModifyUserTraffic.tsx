"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { type FC } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

import { type ModifyTrafficDto, modifyTrafficSchema } from "@/features/admin/schemas/mofify-traffic.schema"
import { useModifyUserTraffic } from "@/features/user/hooks/useModifyUserTraffic"
import type { AdminUser } from "@/features/user/types/user.types"
import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"

type ModifyUserTrafficProps = { user: AdminUser }

const GIB = 1024 ** 3
const trafficFields = [
	{ key: "premiumTrafficLeft", label: "Residential Proxy" },
	{ key: "premiumResidentialTrafficLeft", label: "Premium Residential" },
	{ key: "ispUsaTrafficLeft", label: "ISP USA" },
	{ key: "residentialLiteTrafficLeft", label: "Residential Lite" },
	{ key: "mobileGbTrafficLeft", label: "Mobile GB" },
	{ key: "mobileTrafficLeft", label: "Premium Mobile" }
] as const

const toGb = (bytes: string | null | undefined): number => Number(bytes || "0") / GIB
// Совпадает с точностью backend (целые KiB), чтобы UI не пропускал скрытое уменьшение.
const toBytes = (gb: number): bigint => BigInt(Math.round(gb * 1024 ** 2)) * BigInt(1024)

const ModifyUserTraffic: FC<ModifyUserTrafficProps> = ({ user }) => {
	const { modifyTraffic, isLoading } = useModifyUserTraffic()
	const {
		register,
		handleSubmit,
		formState: { errors, dirtyFields },
		setError
	} = useForm<ModifyTrafficDto>({
		resolver: zodResolver(modifyTrafficSchema),
		defaultValues: Object.fromEntries(
			trafficFields.map(({ key }) => [key, toGb(user[key])])
		) as ModifyTrafficDto
	})

	const onSubmit = (values: ModifyTrafficDto) => {
		const dto: ModifyTrafficDto = {}
		for (const { key } of trafficFields) {
			if (!dirtyFields[key]) continue
			const value = values[key]
			if (value === undefined) continue
			if (toBytes(value) < BigInt(user[key] || "0")) {
				setError(key, { message: "Трафик не может быть меньше текущего остатка" })
				return
			}
			dto[key] = value
		}

		if (Object.keys(dto).length === 0) {
			setError("root", { message: "Сначала измените нужный баланс" })
			return
		}

		modifyTraffic({ id: user.id, dto }, {
			onSuccess: () => toast.success("Трафик пользователя сохранён"),
			onError: ({ message }) => setError("root", { message })
		})
	}

	return (
		<form className="flex w-full min-w-0 flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
			<div className="pr-8">
				<h2 className="text-body text-2xl font-semibold sm:text-3xl">Изменение трафика</h2>
				<p className="text-body/60 mt-1 text-sm">Укажите новый остаток в ГБ. Неизменённые тарифы сохранятся как есть.</p>
			</div>
			<div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
				{trafficFields.map(({ key, label }) => (
					<div className="min-w-0" key={key}>
						<label className="text-body/75 mb-1.5 block text-sm font-medium" htmlFor={`traffic-${key}`}>{label}</label>
						<Input
							id={`traffic-${key}`}
							type="number"
							min="0"
							step="any"
							inputMode="decimal"
							className="min-h-11 pr-14"
							rightLabel="ГБ"
							error={errors[key]?.message}
							{...register(key, { valueAsNumber: true })}
						/>
					</div>
				))}
			</div>
			{errors.root?.message && <Footnote variant="error">{errors.root.message}</Footnote>}
			<Button variant="fill" type="submit" disabled={isLoading}>
				{isLoading ? <Loader /> : "Сохранить"}
			</Button>
		</form>
	)
}

export default ModifyUserTraffic
