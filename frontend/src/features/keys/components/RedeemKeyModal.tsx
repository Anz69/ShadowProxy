import { zodResolver } from "@hookform/resolvers/zod"
import { usePathname } from "next/navigation"
import type { FC } from "react"
import { useForm } from "react-hook-form"

import { useRedeemKey } from "@/features/keys/hooks/useRedeemKey"
import {
	type RedeemKeyDto,
	redeemKeySchema
} from "@/features/keys/schemas/redeem-key.schema"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const RedeemKeyModal: FC = () => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const {
		register,
		setError,
		handleSubmit,
		formState: { errors }
	} = useForm<RedeemKeyDto>({
		resolver: zodResolver(redeemKeySchema),
		defaultValues: {
			key: ""
		}
	})
	const { redeemKey, isLoading } = useRedeemKey()

	const onSubmit = (dto: RedeemKeyDto) => {
		redeemKey(dto, {
			onError: ({ message }) => setError("root", { message })
		})
	}

	return (
		<form
			className="redeem-key-modal-content flex w-full flex-col items-center gap-4"
			onSubmit={handleSubmit(onSubmit)}
		>
			<h2 className="text-body text-2xl font-semibold">
				{T("keys.redeem.title")}
			</h2>
			<p className="text-body/50 w-full text-lg leading-4.5 font-medium">
				{T("keys.redeem.description")}
			</p>
			<Input
				placeholder={T("keys.redeem.placeholder")}
				maxLength={36}
				error={errors.key?.message}
				className="uppercase"
				{...register("key")}
			/>
			{errors.root?.message && (
				<Footnote variant="error">{errors.root.message}</Footnote>
			)}
			<Button variant="white" type="submit" disabled={isLoading}>
				{isLoading ? <Loader /> : T("keys.redeem.button")}
			</Button>
		</form>
	)
}

export default RedeemKeyModal
