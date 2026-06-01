"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { type FC } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

import {
	type ModifyBalanceDto,
	modifyBalanceSchema
} from "@/features/admin/schemas/modify-balance.schema"
import { useModifyUserBalance } from "@/features/user/hooks/useModifyUserBalance"
import type { AdminUser } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"

type ModifyUserBalanceProps = {
	user: AdminUser
}

const ModifyUserBalance: FC<ModifyUserBalanceProps> = ({ user }) => {
	const { modifyBalance, isLoading } = useModifyUserBalance()
	const {
		register,
		handleSubmit,
		formState: { errors },
		setError
	} = useForm<ModifyBalanceDto>({
		resolver: zodResolver(modifyBalanceSchema),
		defaultValues: {
			balance: Number(user.balance) || 0
		}
	})

	const onSubmit = (dto: ModifyBalanceDto) => {
		modifyBalance(
			{
				id: user.id,
				dto
			},
			{
				onSuccess: () => {
					toast.success("Баланс пользователя успешно сохранён!")
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
				Изменение баланса
			</h2>
			<p className="text-body/70 text-center text-base">
				Пользователь: {user.email}
			</p>
			<div className="flex w-full flex-col">
				<span className="text-body/50 text-lg font-medium">
					Баланс
				</span>
				<Input
					type="number"
					step="0.01"
					rightLabel="$"
					error={errors.balance?.message}
					{...register("balance", {
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

export default ModifyUserBalance
