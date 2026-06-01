"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { usePathname } from "next/navigation"
import { type FC, useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import PaymentModal from "@/features/payments/components/PaymentModal"
import TransactionHistory from "@/features/payments/components/TransactionHistory"
import { useBalancePayment } from "@/features/payments/hooks/useBalancePayment"
import type { Package } from "@/features/packages/types/packages.types"
import type {
	ExchangeRates,
	Invoice,
	Merchant,
	AvailableAssets
} from "@/features/payments/types/payment.types"
import type { User } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import Footnote from "@/shared/components/ui/Footnote"
import Input from "@/shared/components/ui/Input"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const balanceSchema = z.object({
	amount: z.number().min(1, "Минимальная сумма пополнения 1$")
})

type BalanceReplenishProps = {
	exchangeRates: ExchangeRates
	packages: Package[]
	payments: Invoice[]
	user?: User | null
}

const BalanceReplenish: FC<BalanceReplenishProps> = ({
	exchangeRates,
	packages,
	payments,
	user
}) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const isOpen = useModalStore((s) => s.isOpen)
	const updateContent = useModalStore((s) => s.updateContent)
	const openModal = useModalStore((s) => s.open)
	const closeModal = useModalStore((s) => s.close)
	const { createBalanceInvoice, isBalanceInvoiceLoading } = useBalancePayment()

	const {
		watch,
		register,
		setValue,
		formState: { errors },
		setError,
		clearErrors
	} = useForm<{ amount: number }>({
		resolver: zodResolver(balanceSchema),
		defaultValues: {
			amount: 1
		}
	})

	useEffect(() => {
		setValue("amount", 1)
	}, [setValue])

	const [merchant, setMerchant] = useState<Merchant>("CRYPTO_BOT")
	const [asset, setAsset] = useState<AvailableAssets>("USDT")
	const [isSuccess, setIsSuccess] = useState(false)
	const [price, setPrice] = useState(1)
	const [assetPrice, setAssetPrice] = useState(0)

	const amount = watch("amount") || 1
	const currentBalance = user ? Number(user.balance) : 0
	const balanceAfterReplenish = currentBalance + (amount || 0)

	useEffect(() => {
		setPrice(amount || 1)
		const calculateAssetPrice = (price: number) => {
			if (asset.startsWith("USD")) {
				setAssetPrice(price)
			} else {
				setAssetPrice(
					price /
						exchangeRates[
							asset as Exclude<AvailableAssets, "USDT" | "USDC">
						]
				)
			}
		}
		calculateAssetPrice(amount || 1)
	}, [amount, asset, exchangeRates])

	const onSubmit = (dto: { merchant?: Merchant; asset?: AvailableAssets }) => {
		const options = {
			onSuccess: (data: Invoice<"balance">) => {
				setIsSuccess(true)
				if (data.paymentUrl) {
					window.open(data.paymentUrl, "_blank")
				}
			},
			onError: ({ message }: { message: string }) =>
				setError("root", {
					message
				})
		}

		const finalMerchant = dto.merchant ?? merchant
		const finalAsset = dto.asset ?? asset

		createBalanceInvoice(
			{
				amount,
				asset: finalAsset,
				merchant: finalMerchant
			},
			options
		)
	}

	const getPaymentModalContent = useCallback(
		() => (
			<PaymentModal
				tariff="RESIDENT_PREMIUM"
				traffic={0}
				packages={[]}
				prices={{ resident_premium: 0, premium_residential: 0, mobile: 0, mobile_gb: 0, ipv6_gb: 0 }}
				exchangeRates={exchangeRates}
				merchant={merchant}
				setMerchant={setMerchant}
				asset={asset}
				setAsset={setAsset}
				price={price}
				assetPrice={assetPrice}
				onSubmit={onSubmit}
				isLoading={isBalanceInvoiceLoading}
				isSuccess={isSuccess}
				error={errors.root?.message}
				clearError={() => clearErrors("root")}
				user={user}
				isBalanceReplenish={true}
			/>
		),
		[exchangeRates, merchant, asset, price, assetPrice, onSubmit, isBalanceInvoiceLoading, isSuccess, errors.root?.message, user]
	)

	const handleOpenPaymentModal = () => {
		openModal(getPaymentModalContent())
	}

	// Обновляем контент модалки при изменении isSuccess/error/isLoading, чтобы отобразить уведомление
	useEffect(() => {
		if (isOpen) {
			updateContent(getPaymentModalContent())
		}
	}, [isOpen, isBalanceInvoiceLoading, isSuccess, errors.root?.message, getPaymentModalContent, updateContent])

	// Закрываем модалку при успешной оплате
	useEffect(() => {
		if (isOpen && isSuccess) {
			closeModal()
		}
	}, [isOpen, isSuccess, closeModal])

	return (
		<div className="flex w-full flex-col gap-6">
			<h1 className="text-body text-[52px] font-semibold">{T("payment.balanceReplenishTitle")}</h1>
			<div className="flex w-full flex-col items-start gap-2 md:flex-row md:gap-2">
				<div className="flex-1 w-full">
					<div className="glass-panel rounded-xl px-4 md:px-8 py-5 flex flex-col gap-4 w-full">
						<h2 className="text-body text-3xl font-semibold">
							{T("payment.title")}
						</h2>
						
						{/* Поля баланса в ряд */}
						<div className="flex w-full flex-col md:flex-row gap-4">
							{/* Текущий баланс */}
							<div className="flex-1 flex flex-col gap-1">
								<span className="text-white text-xl font-semibold">
									{T("payment.currentBalance")}
								</span>
								<div className="glass-panel rounded-xl px-4 py-3">
									<span className="text-body text-base font-medium">
										{currentBalance.toFixed(2)}$
									</span>
								</div>
							</div>

							{/* Поле пополнения */}
							<div className="flex-1 flex flex-col gap-1">
								<span className="text-white text-xl font-semibold">
									{T("payment.replenish")}
								</span>
								<Input
									placeholder={T("payment.replenishPlaceholder")}
									type="number"
									step="0.01"
									min="1"
									error={errors.amount?.message}
									className="w-full !bg-transparent !border !border-white/20 hover:!border-[#0067FF] focus:!border-[#0067FF] !px-4 !py-3 !rounded-xl"
									{...register("amount", {
										valueAsNumber: true
									})}
									title=""
								/>
							</div>

							{/* Баланс после пополнения */}
							<div className="flex-1 flex flex-col gap-1">
								<span className="text-white text-xl font-semibold">
									{T("payment.balanceAfterReplenish")}
								</span>
								<div className="glass-panel rounded-xl px-4 py-3">
									<span className="text-body text-base font-medium">
										{balanceAfterReplenish.toFixed(2)}$
									</span>
								</div>
							</div>
						</div>

						<div className="flex w-full flex-row items-end justify-between gap-2">
							<span className="text-white/30 text-2xl font-semibold md:text-3xl">
								{T("payment.total")}
							</span>
							<span className="text-body text-xl font-semibold md:text-2xl">
								{(price || 0).toFixed(2)}$
							</span>
						</div>

						{errors.root?.message && (
							<Footnote variant="error">
								{errors.root.message}
							</Footnote>
						)}
						{isSuccess && (
							<Footnote variant="success">
								{T("payment.successMessage")}
							</Footnote>
						)}
						<Button
							variant="white"
							type="button"
							disabled={!amount || amount < 1}
							className="px-9 py-3 w-full"
							onClick={handleOpenPaymentModal}
						>
							{T("payment.buy")}
						</Button>
					</div>
				</div>
				<div className="h-full w-full md:w-auto">
					<TransactionHistory payments={payments} packages={packages} locale={locale} />
				</div>
			</div>
		</div>
	)
}

export default BalanceReplenish

