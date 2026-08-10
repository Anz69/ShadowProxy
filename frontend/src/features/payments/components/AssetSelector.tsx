import Image from "next/image"
import type { SupportedLocale } from "@/shared/utils/i18n"

import { availableAssets } from "@/features/payments/constants/payment.constants"
import type { AvailableAssets } from "@/features/payments/types/payment.types"
import Input from "@/shared/components/ui/Input"
import { t } from "@/shared/utils/i18n"

type Props = {
	asset: AvailableAssets
	setAsset: (value: AvailableAssets) => void
	locale?: SupportedLocale
	isModal?: boolean
}

const AssetSelector = ({ asset, setAsset, locale = "ru", isModal = false }: Props) => {
	const T = (key: string) => t(key, locale)
	
	if (isModal) {
		return (
			<div className="flex w-full flex-col gap-2">
				<span className="text-white/50 text-base font-medium">{T("payment.currency")}</span>
				<div className="grid w-full grid-cols-1 md:grid-cols-2 gap-2">
					{availableAssets.map(({ value, label }) => (
						<div
							key={value}
							onClick={() => setAsset(value as AvailableAssets)}
							className={`glass-tile ${asset === value ? "is-active" : ""} flex h-[46px] w-full flex-row items-center justify-center gap-2 rounded-xl p-3`}
						>
							<Image
								src={`/crypto/${value.toLowerCase()}.svg`}
								alt={label}
								width={value === "ETH" ? 18 : 24}
								height={value === "ETH" ? 18 : 24}
								className={value === "ETH" ? "ml-[3px]" : ""}
							/>
							<span className="text-white text-base font-medium">{label}</span>
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className="flex w-full flex-col gap-1">
			<span className="text-white text-xl font-semibold">{T("payment.currency")}</span>
			<div className="flex flex-col md:grid w-full grid-cols-2 gap-2 md:gap-3">
				{availableAssets.map(({ value, label }) => (
					<div
						key={value}
						onClick={() => setAsset(value as AvailableAssets)}
						className={`glass-tile ${asset === value ? "is-active" : ""} flex h-[46px] w-full flex-row items-center justify-between rounded-xl p-3`}
					>
						<Image
							src={`/crypto/${value.toLowerCase()}.svg`}
							alt={label}
							width={value === "ETH" ? 18 : 24}
							height={value === "ETH" ? 18 : 24}
							className={value === "ETH" ? "ml-[3px]" : ""}
						/>
						<span className="text-body text-xl font-medium">{label}</span>
					</div>
				))}
			</div>
		</div>
	)
}

export default AssetSelector
