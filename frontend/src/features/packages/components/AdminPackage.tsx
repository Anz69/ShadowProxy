import { zodResolver } from "@hookform/resolvers/zod"
import type { FC } from "react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"

import {
	type PackageDto,
	packageSchema
} from "@/features/admin/schemas/package.schema"
import { useDeletePackage } from "@/features/packages/hooks/useDeletePackage"
import type { Package } from "@/features/packages/types/packages.types"
import { useModifyPackage } from "@/features/proxy/hooks/useModifyPackage"

import Button from "@/shared/components/ui/Button"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"

type AdminPackageProps = {
	_package: Package
}

const AdminPackage: FC<AdminPackageProps> = ({ _package }) => {
	const { register, handleSubmit } = useForm({
		resolver: zodResolver(packageSchema),
		defaultValues: {
			type: _package.type,
			traffic: Number(BigInt(_package.traffic)) / 1024 ** 3,
			price: _package.price
		}
	})
	const { updatePackage, isLoading: isUpdateLoading } = useModifyPackage()
	const { deletePackage, isLoading: isDeleteLoading } = useDeletePackage()

	const onSubmit = (dto: PackageDto) => {
		updatePackage({
			dto,
			id: _package.id
		})
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="glass-panel flex w-full flex-col gap-2 rounded-xl p-4"
		>
			<div className="flex w-full flex-col gap-1">
				<span className="text-body/50 text-base font-medium">
					Трафик
				</span>
				<Input
					rightLabel="Гб"
					{...register("traffic", {
						valueAsNumber: true
					})}
				/>
			</div>
			<Button variant="fill" type="submit" disabled={isUpdateLoading}>
				{isUpdateLoading ? <Loader /> : "Сохранить"}
			</Button>
			<Button
				variant="error"
				type="button"
				disabled={isDeleteLoading}
				onClick={() => deletePackage(_package.id)}
			>
				{isDeleteLoading ? <Loader /> : "Удалить"}
			</Button>
		</form>
	)
}

export default AdminPackage
