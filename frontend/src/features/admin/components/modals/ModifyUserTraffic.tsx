"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { type FC } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

import {
	type ModifyTrafficDto,
	modifyTrafficSchema
} from "@/features/admin/schemas/mofify-traffic.schema"
import { useModifyUserTraffic } from "@/features/user/hooks/useModifyUserTraffic"
import type { AdminUser } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"

type ModifyUserTrafficProps = {
	user: AdminUser
}

const ModifyUserTraffic: FC<ModifyUserTrafficProps> = ({ user }) => {
	const { modifyTraffic, isLoading } = useModifyUserTraffic()
	const {
		register,
		handleSubmit,
		formState: { errors },
		setError
	} = useForm<ModifyTrafficDto>({
		resolver: zodResolver(modifyTrafficSchema),
		defaultValues: {
			premiumTrafficLeft: Number(
				Number(
					BigInt(user.premiumTrafficLeft) / BigInt(1024 ** 3)
				).toFixed(2)
			),
			mobileGbTrafficLeft: Number(
				Number(
					BigInt(user.mobileGbTrafficLeft || "0") / BigInt(1024 ** 3)
				).toFixed(2)
			),
			ipv6GbTrafficLeft: Number(
				Number(
					BigInt(user.ipv6GbTrafficLeft || "0") / BigInt(1024 ** 3)
				).toFixed(2)
			),
			premiumResidentialTrafficLeft: Number(
				Number(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					BigInt((user as any).premiumResidentialTrafficLeft || "0") / BigInt(1024 ** 3)
				).toFixed(2)
			),
			mobileTrafficLeft: Number(
				Number(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					BigInt((user as any).mobileTrafficLeft || "0") / BigInt(1024 ** 3)
				).toFixed(2)
			)
		}
	})

	const onSubmit = (dto: ModifyTrafficDto) => {
		if (
			dto.premiumTrafficLeft <
			Number(BigInt(user.premiumTrafficLeft) / BigInt(1024 ** 3))
		) {
			setError("premiumTrafficLeft", {
				message: "Трафик не может быть меньше, чем был"
			})
			return
		}
		if (
			dto.mobileGbTrafficLeft <
			Number(BigInt(user.mobileGbTrafficLeft || "0") / BigInt(1024 ** 3))
		) {
			setError("mobileGbTrafficLeft", {
				message: "Трафик не может быть меньше, чем был"
			})
			return
		}
		if (
			dto.ipv6GbTrafficLeft <
			Number(BigInt(user.ipv6GbTrafficLeft || "0") / BigInt(1024 ** 3))
		) {
			setError("ipv6GbTrafficLeft", {
				message: "Трафик не может быть меньше, чем был"
			})
			return
		}
		modifyTraffic(
			{
				id: user.id,
				dto
			},
			{
				onSuccess: () => {
					toast.success("Трафик пользователя успешно сохранён!")
				},
				onError: ({ message }) =>
					setError("root", {
						message
					})
			}
		)
	}

	return (
		<form
			className="flex w-full flex-col items-center gap-4"
			onSubmit={handleSubmit(onSubmit)}
		>
			<h2 className="text-body text-3xl font-semibold">
				Изменение трафика
			</h2>
			<div className="flex w-full flex-col">
				<span className="text-body/50 text-lg font-medium">
					Residential Proxy (Delvin23)
				</span>
				<Input
					type="number"
					step="0.001"
					rightLabel="Гб"
					error={errors.premiumTrafficLeft?.message}
					{...register("premiumTrafficLeft", {
						valueAsNumber: true
					})}
				/>
			</div>
			<div className="flex w-full flex-col">
				<span className="text-body/50 text-lg font-medium">
					Premium Residential (ProxyEmpire)
				</span>
				<Input
					type="number"
					step="0.001"
					rightLabel="Гб"
					error={errors.premiumResidentialTrafficLeft?.message}
					{...register("premiumResidentialTrafficLeft", {
						valueAsNumber: true
					})}
				/>
			</div>
			<div className="flex w-full flex-col">
				<span className="text-body/50 text-lg font-medium">
					Mobile GB
				</span>
				<Input
					type="number"
					step="0.001"
					rightLabel="Гб"
					error={errors.mobileGbTrafficLeft?.message}
					{...register("mobileGbTrafficLeft", {
						valueAsNumber: true
					})}
				/>
			</div>
			<div className="flex w-full flex-col">
				<span className="text-body/50 text-lg font-medium">
					Mobile (ProxyEmpire)
				</span>
				<Input
					type="number"
					step="0.001"
					rightLabel="Гб"
					error={errors.mobileTrafficLeft?.message}
					{...register("mobileTrafficLeft", {
						valueAsNumber: true
					})}
				/>
			</div>
			<div className="flex w-full flex-col">
				<span className="text-body/50 text-lg font-medium">
					IPv6 прокси
				</span>
				<Input
					type="number"
					step="0.001"
					rightLabel="Гб"
					error={errors.ipv6GbTrafficLeft?.message}
					{...register("ipv6GbTrafficLeft", {
						valueAsNumber: true
					})}
				/>
			</div>
			{errors.root?.message && (
				<Footnote variant="error">{errors.root.message}</Footnote>
			)}
			<Button variant="fill" type="submit" disabled={isLoading}>
				{isLoading ? <Loader /> : "Сохранить"}
			</Button>
		</form>
	)
}

export default ModifyUserTraffic
