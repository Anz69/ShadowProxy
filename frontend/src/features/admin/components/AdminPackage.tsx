import { zodResolver } from "@hookform/resolvers/zod"
import type { FC } from "react"
import { useForm } from "react-hook-form"

import { type PackageDto, packageSchema } from "@/features/admin/schemas/package.schema"
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
			traffic: Number(BigInt(_package.traffic) / BigInt(1024 ** 3)),
			price: _package.price
		}
	})
	const { updatePackage, isLoading } = useModifyPackage()

	const onSubmit = (dto: PackageDto) => {
		updatePackage({
			dto,
			id: _package.id
		})
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="bg-card/25 border-body/25 flex w-full flex-col gap-2 rounded-xl border-2 p-4">
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
			<div className="flex w-full flex-col gap-1">
				<span className="text-body/50 text-base font-medium">Цена</span>
				<Input
					rightLabel="$"
					{...register("price", {
						valueAsNumber: true
					})}
				/>
			</div>
			<Button variant="fill" type="submit" disabled={isLoading}>
				{isLoading ? <Loader /> : "Сохранить"}
			</Button>
		</form>
	)
}

export default AdminPackage
