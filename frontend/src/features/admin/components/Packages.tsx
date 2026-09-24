"use client"

import { Plus } from "lucide-react"
import type { FC } from "react"

import AddPackage from "@/features/admin/components/modals/AddPackage"
import AdminPackage from "@/features/packages/components/AdminPackage"
import { usePackages } from "@/features/packages/hooks/usePackages"

import Card from "@/shared/components/ui/Card"
import Loader from "@/shared/components/ui/Loader/Loader"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { sortByCreatedAtDesc } from "@/shared/utils/sort-by-created-at-desc"

// Группы пакетов = актуальные публичные тарифы. Пакет — это быстрый объём
// (пресет) на странице оплаты; цена берётся из тарификации.
const PACKAGE_GROUPS: { type: string; label: string }[] = [
	{ type: "RESIDENT_PREMIUM", label: "Residential" },
	{ type: "PREMIUM_RESIDENTIAL", label: "Premium Residential" },
	{ type: "MOBILE", label: "Premium Mobile" },
	{ type: "MOBILE_GB", label: "Mobile ГБ" },
	{ type: "IPV6_GB", label: "IPv6 ГБ" },
	{ type: "ISP_USA", label: "ISP USA" },
	{ type: "ISP_EU", label: "ISP Netherlands" },
	{ type: "RESIDENTIAL_LITE", label: "Residential Lite" }
]

const Packages: FC = () => {
	const { packages } = usePackages()
	const { open } = useModalStore()

	if (!packages)
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Loader weight={5} size={80} />
			</div>
		)
	return (
		<Card>
			<div className="flex w-full flex-col gap-1">
				<h1 className="text-body text-3xl font-semibold">Пакеты</h1>
				<span className="text-body/40 text-sm">
					Быстрые объёмы (пресеты оплаты) по каждому тарифу. Цена считается из тарификации.
				</span>
			</div>
			{PACKAGE_GROUPS.map(group => (
				<div className="flex w-full flex-col gap-2" key={group.type}>
					<span className="text-body/50 text-lg font-medium">
						{group.label}
					</span>
					<div className="grid grid-cols-3 gap-4">
						{packages
							.filter(el => el.type === group.type)
							.sort(sortByCreatedAtDesc)
							.map(el => (
								<AdminPackage _package={el} key={el.id} />
							))}
						<div
							className="glass-tile flex w-full flex-col items-center justify-center gap-2 rounded-xl p-4"
							onClick={() => open(<AddPackage initialType={group.type} />)}
						>
							<Plus className="text-body h-10 w-10" />
						</div>
					</div>
				</div>
			))}
		</Card>
	)
}

export default Packages
