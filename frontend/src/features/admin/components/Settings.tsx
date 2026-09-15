import type { FC } from "react"

import AdminNav from "@/features/admin/components/AdminNav"
import Packages from "@/features/admin/components/Packages"
import ProxyPricesModifier from "@/features/admin/components/ProxyPricesModifier"
import type { Prices } from "@/features/proxy/types/proxy.types"

type SettingsProps = {
	prices: Prices
}

const Settings: FC<SettingsProps> = ({ prices }) => {
	return (
		<div className="relative z-[1] flex w-full flex-col gap-6">
			<h1 className="font-[TalosDisplay] text-4xl font-semibold text-white md:text-5xl">
				Настройки
			</h1>
			<AdminNav active="/admin/settings" />
			<div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
				<ProxyPricesModifier prices={prices} />
				<Packages />
			</div>
		</div>
	)
}

export default Settings
