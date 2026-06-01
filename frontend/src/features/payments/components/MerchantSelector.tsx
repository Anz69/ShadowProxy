import Image from "next/image"
import type { SupportedLocale } from "@/shared/utils/i18n"

import type { Merchant } from "@/features/payments/types/payment.types"
import { t } from "@/shared/utils/i18n"

type Props = {
	merchant: Merchant
	setMerchant: (value: Merchant) => void
	locale?: SupportedLocale
	isModal?: boolean
}

const MerchantSelector = ({ merchant, setMerchant, locale = "ru", isModal = false }: Props) => {
	const T = (key: string) => t(key, locale)
	
	if (isModal) {
		return (
			<div className="flex w-full flex-col gap-2">
				<span className="text-white/50 text-base font-medium">{T("payment.merchant")}</span>
				<div className="grid w-full grid-cols-1 md:grid-cols-2 gap-2">
					<div
						onClick={() => setMerchant("CRYPTO_BOT")}
						className={`glass-tile ${merchant === "CRYPTO_BOT" ? "is-active" : ""} flex h-[46px] w-full flex-row items-center justify-center gap-2 rounded-xl p-3`}
					>
						<Image
							src="/crypto_bot.svg"
							alt="Crypto Bot"
							width={40}
							height={22}
						/>
						<span className="text-white text-base font-medium">
							CryptoBot
						</span>
					</div>

					<div
						onClick={() => setMerchant("HELEKET")}
						className={`glass-tile ${merchant === "HELEKET" ? "is-active" : ""} flex h-[46px] w-full flex-row items-center justify-center gap-2 rounded-xl p-3`}
					>
						<Image
							src="/heleket.svg"
							alt="Heleket"
							width={22}
							height={26}
						/>
						<span className="text-white text-base font-medium">
							Heleket
						</span>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex w-full flex-col gap-1">
			<span className="text-white text-xl font-semibold">{T("payment.merchant")}</span>
			<div className="flex w-full flex-col md:flex-row items-center gap-2 md:gap-3">
				<div
					onClick={() => setMerchant("CRYPTO_BOT")}
					className={`glass-tile ${merchant === "CRYPTO_BOT" ? "is-active" : ""} flex h-[46px] w-full flex-row items-center justify-between rounded-xl p-3`}
				>
					<Image
						src="/crypto_bot.svg"
						alt="Crypto Bot"
						width={40}
						height={22}
					/>
					<span className="text-body text-xl font-medium">
						CryptoBot
					</span>
				</div>

				<div
					onClick={() => setMerchant("HELEKET")}
					className={`glass-tile ${merchant === "HELEKET" ? "is-active" : ""} flex h-[46px] w-full flex-row items-center justify-between rounded-xl p-3`}
				>
					<Image
						src="/heleket.svg"
						alt="Heleket"
						width={22}
						height={26}
					/>
					<span className="text-body text-xl font-medium">
						Heleket
					</span>
				</div>
			</div>
		</div>
	)
}

export default MerchantSelector
