"use client"

import { BadgeCent, Key, Clock } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type FC, useState } from "react"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"

import RedeemKeyModal from "@/features/keys/components/RedeemKeyModal"
import IspForm from "@/features/proxy/components/IspForm"
import MobileForm from "@/features/proxy/components/MobileForm"
import PremiumResidentialForm from "@/features/proxy/components/PremiumResidentialForm"
import type {
	Locations,
	Plan,
	Prices
} from "@/features/proxy/types/proxy.types"
import type { User } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import SegmentedControl from "@/shared/components/ui/SegmentedControl"

type ProxyConfiguratorProps = {
	locations: Locations
	plans: Plan[]
	prices: Prices
	user: User | null
}

const ProxyConfigurator: FC<ProxyConfiguratorProps> = ({
	locations,
	plans,
	prices,
	user
}) => {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const getLocalizedLink = (path: string) => addLocaleToPath(path, currentLocale)
	
	const [proxyType, setProxyType] = useState<
		"ISP" | "Mobile" | "PremiumResidential"
	>("ISP")
	const { open } = useModalStore()

	const premiumResidentialLocations =
		locations.premiumResidential ?? []

	const proxyTypes = {
		Mobile: (
			<MobileForm
				locations={locations.mobile}
				prices={prices}
				user={user}
			/>
		),
		ISP: <IspForm locations={[...new Set(locations.isp)]} user={user} />,
		PremiumResidential: (
			<PremiumResidentialForm
				locations={premiumResidentialLocations}
				prices={prices}
				user={user}
			/>
		)
	}

	return (
		<div className="flex w-full flex-col items-center gap-2 md:w-[1152px] md:gap-6">
			<div className="flex w-full flex-col md:gap-2">
				<span className="text-body/50 text-lg font-medium md:text-2xl md:font-semibold">
					Тип прокси
				</span>
				<SegmentedControl
					options={["ISP", "Mobile", "PremiumResidential"]}
					value={proxyType}
					onChange={val =>
						setProxyType(
							val as "ISP" | "Mobile" | "PremiumResidential"
						)
					}
				/>
			</div>
			{proxyType === "ISP" && user && (
				<div className="bg-card border-body/25 flex w-full flex-col items-center justify-between gap-4 rounded-xl border-2 px-4 py-4 md:flex-row md:gap-0 md:px-9 md:py-5">
					<div className="flex w-full items-end justify-between md:w-fit md:flex-col md:items-start">
						<h1 className="text-body/50 text-2xl font-medium">
							Баланс:
						</h1>
						<span className="text-body text-3xl font-semibold">
							{`${user.ispIpLeft} IP`}
						</span>
					</div>
					<div className="flex w-full flex-col gap-3 md:w-[340px]">
						<Link href={getLocalizedLink("/payment")} className="w-full">
							<Button variant="white" type="button">
								<BadgeCent className="h-6 w-6" />
								Пополнить GB
							</Button>
						</Link>
						<Link href={getLocalizedLink("/payment")} className="w-full">
							<Button variant="white" type="button">
								<Clock className="h-6 w-6" />
								Пополнить время
							</Button>
						</Link>
						<Button
							variant="white"
							type="button"
							onClick={() => open(<RedeemKeyModal />)}
						>
							<Key className="h-5 w-5" />
							Активировать ключ
						</Button>
					</div>
				</div>
			)}
			{proxyTypes[proxyType]}
		</div>
	)
}

export default ProxyConfigurator
