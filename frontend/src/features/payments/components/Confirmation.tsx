"use client"

import { useSearchParams } from "next/navigation"
import { type FC, useState } from "react"

import AssetSelector from "@/features/payments/components/AssetSelector"
import ConfirmationInfo from "@/features/payments/components/ConfirmationInfo"
import MerchantSelector from "@/features/payments/components/MerchantSelector"
import { useMobilePayment } from "@/features/payments/hooks/useMobilePayment"
import type {
	AvailableAssets,
	ExchangeRates,
	Merchant
} from "@/features/payments/types/payment.types"

import Button from "@/shared/components/ui/Button"
import Card from "@/shared/components/ui/Card"
import Footnote from "@/shared/components/ui/Footnote"
import Loader from "@/shared/components/ui/Loader/Loader"

type ConfirmationProps = {
	exchangeRates: ExchangeRates
}

const Confirmation: FC<ConfirmationProps> = ({ exchangeRates }) => {
	const [merchant, setMerchant] = useState<Merchant>("CRYPTO_BOT")
	const [asset, setAsset] = useState<AvailableAssets>("USDT")
	const { createInvoice, isLoading } = useMobilePayment()
	const [error, setError] = useState("")
	const [isSuccess, setIsSuccess] = useState(false)
	const [willRedirect, setWillRedirect] = useState(false)

	try {
		const params = useSearchParams()
		const data = params.get("data")
		if (!data) return null
		const parsedData = JSON.parse(atob(data))

		const onSubmit = () => {
			setError("")
			createInvoice(
				{
					asset,
					merchant,
					planId: parsedData.planId,
					rentTime: Number(parsedData.rentTime)
				},
				{
					onSuccess: data => {
						setIsSuccess(true)
						// Не делаем редирект, если оплата с баланса (paymentUrl будет null)
						if (data.paymentUrl) {
							setWillRedirect(true)
							window.open(data.paymentUrl, "_blank")
						}
					},
					onError: e => setError(e.message)
				}
			)
		}

		return (
			<Card className="w-full md:w-150 !gap-2 md:gap-4">
				<h2 className="text-body text-3xl font-semibold">Оплата</h2>
				<ConfirmationInfo parsedData={parsedData} />
				<MerchantSelector
					merchant={merchant}
					setMerchant={setMerchant}
				/>
				<AssetSelector asset={asset} setAsset={setAsset} />
				<div className="flex w-full flex-row items-end justify-between gap-2">
					<span className="text-body text-2xl md:text-3xl font-semibold">
						Итого:
					</span>
					<div className="border-body/25 mb-1 grow border-b-2 border-dotted" />
					<span className="text-body text-xl md:text-2xl font-semibold">
						{asset.startsWith("USD")
							? parsedData.price
							: (
									parsedData.price /
									exchangeRates[
										asset as Exclude<
											AvailableAssets,
											"USDT" | "USDC"
										>
									]
								).toFixed(5)}{" "}
						{asset}
					</span>
				</div>

				{!!error.length && <Footnote variant="error">{error}</Footnote>}
				{isSuccess && (
					<Footnote variant="success">
						{willRedirect
							? "Платёж успешно сформирован. Вы будете перенаправлены на страницу оплаты"
							: "Оплата прошла успешно — пакет активируется."}
					</Footnote>
				)}
				<Button
					variant="fill"
					type="button"
					disabled={isLoading}
					onClick={onSubmit}
				>
					{isLoading ? (
						<Loader size={20} weight={2} />
					) : (
						"Перейти к оплате"
					)}
				</Button>
			</Card>
		)
	} catch {
		return null
	}
}

export default Confirmation
