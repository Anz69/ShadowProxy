"use client"

import Image from "next/image"
import { X } from "lucide-react"
import { usePathname } from "next/navigation"
import React, { type FC } from "react"

import { availableAssets } from "@/features/payments/constants/payment.constants"
import { formatSeconds } from "@/shared/utils/format-seconds"
import type {
	AvailableAssets,
	ExchangeRates,
	Merchant,
	ResidentTariff
} from "@/features/payments/types/payment.types"
import type { Package as PackageType } from "@/features/packages/types/packages.types"
import type { Prices } from "@/features/proxy/types/proxy.types"
import type { User } from "@/features/user/types/user.types"

import Footnote from "@/shared/components/ui/Footnote"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { useActiveDiscount } from "@/features/payments/hooks/useActiveDiscount"

type PaymentModalProps = {
	tariff: ResidentTariff | "MOBILE" | "MOBILE_GB" | "IPV6"
	traffic: number
	packages: PackageType[]
	prices: Prices
	exchangeRates: ExchangeRates
	merchant: Merchant
	setMerchant: (value: Merchant) => void
	asset: AvailableAssets
	setAsset: (value: AvailableAssets) => void
	price: number
	assetPrice: number
	onSubmit: (dto: { traffic: number; merchant?: Merchant; asset?: AvailableAssets }) => void
	isLoading: boolean
	isSuccess: boolean
	error?: string
	clearError?: () => void
	mobileData?: {
		planId: string
		rentTime: number
		country: string
		planName?: string
	}
	user?: User | null
	isBalanceReplenish?: boolean
}

const SparkIcon = () => (
	<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
		<path d="M7 0L8.6 4.4L13 5.5L8.6 6.6L7 11L5.4 6.6L1 5.5L5.4 4.4L7 0Z" fill="currentColor" />
	</svg>
)

const CheckIcon = () => (
	<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
		<path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const ArrowRightIcon = () => (
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<path d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const Spinner = () => <span className="pay-modal__spinner" aria-hidden="true" />

const PaymentModal: FC<PaymentModalProps> = ({
	tariff,
	traffic,
	prices: _prices,
	packages: _packages,
	exchangeRates,
	merchant: initialMerchant,
	setMerchant: setMerchantParent,
	asset: initialAsset,
	setAsset: setAssetParent,
	price,
	assetPrice: initialAssetPrice,
	onSubmit,
	isLoading,
	isSuccess,
	error,
	clearError,
	mobileData,
	user,
	isBalanceReplenish = false
}) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const { close } = useModalStore()
	const [merchant, setMerchant] = React.useState<Merchant>(initialMerchant)
	const [asset, setAsset] = React.useState<AvailableAssets>(initialAsset)
	const [assetPrice, setAssetPrice] = React.useState(initialAssetPrice)

	const { data: activeDiscount } = useActiveDiscount(!isBalanceReplenish)
	const discountPct = !isBalanceReplenish && activeDiscount ? activeDiscount.pct : 0
	const discountMul = discountPct > 0 ? 1 - discountPct / 100 : 1
	const discountedPrice = price * discountMul
	const discountedAssetPrice = assetPrice * discountMul

	React.useEffect(() => {
		setMerchant(initialMerchant)
		setAsset(initialAsset)
		setAssetPrice(initialAssetPrice)
	}, [initialMerchant, initialAsset, initialAssetPrice])

	React.useEffect(() => {
		const calculateAssetPrice = (p: number) => {
			if (asset.startsWith("USD")) {
				setAssetPrice(p)
			} else {
				setAssetPrice(p / exchangeRates[asset as Exclude<AvailableAssets, "USDT" | "USDC">])
			}
		}
		if (merchant !== "BALANCE" && merchant !== "REFERRAL_BALANCE") {
			calculateAssetPrice(price)
		}
	}, [asset, price, exchangeRates, merchant])

	const isBalanceMerchant = merchant === "BALANCE" || merchant === "REFERRAL_BALANCE"
	const userBalance = user ? Number(user.balance) : 0
	const userReferralBalance = user ? Number(user.referralBalance) : 0
	const selectedBalance = merchant === "BALANCE" ? userBalance : merchant === "REFERRAL_BALANCE" ? userReferralBalance : 0
	const hasEnoughBalance = selectedBalance >= price

	const getTariffName = () => {
		if (isBalanceReplenish) return T("payment.balance")
		if (tariff === "RESIDENT" || tariff === "RESIDENT_PREMIUM") return T("payment.tariffTypes.resident")
		if (tariff === "MOBILE") return T("payment.tariffTypes.mobile")
		if (tariff === "MOBILE_GB") return T("payment.tariffTypes.mobileGb")
		if (tariff === "IPV6") return T("payment.tariffTypes.ipv6")
		return ""
	}

	const handleSubmit = () => {
		if (clearError) clearError()
		setMerchantParent(merchant)
		setAssetParent(asset)
		onSubmit({ traffic, merchant, asset })
	}

	type MerchantOption = { key: Merchant; label: string; icon?: string; balance?: number }
	const merchantOptions: MerchantOption[] = [
		{ key: "CRYPTO_BOT", label: "CryptoBot", icon: "/crypto_bot.svg" },
		{ key: "HELEKET", label: "Heleket", icon: "/heleket.svg" }
	]
	if (!isBalanceReplenish) {
		merchantOptions.push(
			{ key: "BALANCE", label: T("payment.balance"), balance: userBalance },
			{ key: "REFERRAL_BALANCE", label: T("payment.referralBalance"), balance: userReferralBalance }
		)
	}

	return (
		<div className="pay-modal">

			<header className="pay-modal__header">
				<span className="pay-modal__eyebrow">
					<SparkIcon />
					{T("payment.pageTitle")}
				</span>
				<h2 className="pay-modal__title">
					{isBalanceReplenish ? T("payment.balance") : T("payment.title")}
				</h2>
			</header>

			{/* ── Order summary ── */}
			<section className="pay-modal__summary">
				<div className="pay-modal__summary-row">
					<span className="pay-modal__summary-label">
						{T("payment.tariffType") || "Тип тарифа"}
					</span>
					<span className="pay-modal__summary-value">{getTariffName()}</span>
				</div>

				{tariff === "MOBILE" && mobileData ? (
					<>
						<div className="pay-modal__summary-row">
							<span className="pay-modal__summary-label">{T("payment.country") || "Страна"}</span>
							<span className="pay-modal__summary-value">
								{new Intl.DisplayNames(["ru"], { type: "region" }).of(mobileData.country.toUpperCase()) || mobileData.country}
							</span>
						</div>
						<div className="pay-modal__summary-row">
							<span className="pay-modal__summary-label">Оператор</span>
							<span className="pay-modal__summary-value">{mobileData.planName || "Не выбран"}</span>
						</div>
						<div className="pay-modal__summary-row">
							<span className="pay-modal__summary-label">{T("payment.rentTime") || "Срок аренды"}</span>
							<span className="pay-modal__summary-value">{formatSeconds(mobileData.rentTime)}</span>
						</div>
					</>
				) : tariff === "MOBILE" ? (
					<>
						<div className="pay-modal__summary-row">
							<span className="pay-modal__summary-label">{T("payment.country") || "Страна"}</span>
							<span className="pay-modal__summary-value pay-modal__summary-value--muted">
								{T("payment.selectCountry") || "Выберите страну"}
							</span>
						</div>
						<div className="pay-modal__summary-row">
							<span className="pay-modal__summary-label">{T("payment.rentTime") || "Срок аренды"}</span>
							<span className="pay-modal__summary-value pay-modal__summary-value--muted">
								{T("payment.selectRentTime") || "Выберите срок аренды"}
							</span>
						</div>
					</>
				) : isBalanceReplenish ? (
					<div className="pay-modal__summary-row">
						<span className="pay-modal__summary-label">{T("payment.traffic")}</span>
						<span className="pay-modal__summary-value">{price.toFixed(2)}$</span>
					</div>
				) : (
					<div className="pay-modal__summary-row">
						<span className="pay-modal__summary-label">{T("payment.traffic")}</span>
						<span className="pay-modal__summary-value">{traffic} {T("payment.units.gb")}</span>
					</div>
				)}
			</section>

			{/* ── Payment method ── */}
			<section className="pay-modal__section">
				<span className="pay-modal__section-label">{T("payment.merchant")}</span>
				<div className="pay-modal__grid">
					{merchantOptions.map(opt => {
						const isActive = merchant === opt.key
						return (
							<button
								key={opt.key}
								type="button"
								onClick={(e) => { e.stopPropagation(); setMerchant(opt.key) }}
								className={`pay-option ${isActive ? "pay-option--active" : ""}`}
								aria-pressed={isActive}
							>
								<span className="pay-option__inner">
									{opt.icon && (
										<span className="pay-option__icon">
											<Image src={opt.icon} alt="" width={20} height={20} />
										</span>
									)}
									<span className="pay-option__body">
										<span className="pay-option__label">{opt.label}</span>
										{opt.balance !== undefined && (
											<span className="pay-option__balance">{opt.balance.toFixed(2)}$</span>
										)}
									</span>
								</span>
								<span className={`pay-option__mark ${isActive ? "pay-option__mark--on" : ""}`} aria-hidden="true">
									{isActive && <CheckIcon />}
								</span>
							</button>
						)
					})}
				</div>
			</section>

			{/* ── Currency (if non-balance) ── */}
			{!isBalanceMerchant && (
				<section className="pay-modal__section">
					<span className="pay-modal__section-label">{T("payment.currency")}</span>
					<div className="pay-modal__grid">
						{availableAssets.map(({ value, label }) => {
							const isActive = asset === value
							return (
								<button
									key={value}
									type="button"
									onClick={(e) => { e.stopPropagation(); setAsset(value as AvailableAssets) }}
									className={`pay-option ${isActive ? "pay-option--active" : ""}`}
									aria-pressed={isActive}
								>
									<span className="pay-option__inner">
										<span className="pay-option__icon">
											<Image src={`/crypto/${value.toLowerCase()}.svg`} alt={label} width={20} height={20} />
										</span>
										<span className="pay-option__body">
											<span className="pay-option__label">{label}</span>
										</span>
									</span>
									<span className={`pay-option__mark ${isActive ? "pay-option__mark--on" : ""}`} aria-hidden="true">
										{isActive && <CheckIcon />}
									</span>
								</button>
							)
						})}
					</div>
				</section>
			)}

			{/* ── Total HERO ── */}
			<section className="pay-modal__total">
				{discountPct > 0 && (
					<div className="pay-modal__total-discount">
						<span className="pay-modal__total-discount-label">
							{T("payment.discountLabel")} −{discountPct}%
						</span>
						<span className="pay-modal__total-strike">{price.toFixed(2)}$</span>
					</div>
				)}
				<div className="pay-modal__total-row">
					<span className="pay-modal__total-label">{T("payment.total")}</span>
					<span className="pay-modal__total-value">
						{isBalanceMerchant ? (
							<>{discountedPrice.toFixed(2)}$</>
						) : (
							<>
								{discountedAssetPrice.toFixed(asset.startsWith("USD") ? 2 : 5)} {asset}
								<span className="pay-modal__total-secondary">({discountedPrice.toFixed(2)}$)</span>
							</>
						)}
					</span>
				</div>
			</section>

			{error && <Footnote variant="error">{error}</Footnote>}

			{isSuccess && (
				<Footnote variant="success">
					{isBalanceMerchant
						? T("payment.successBalance")
						: T("payment.redirectWarning") || "Вы будете перенаправлены на страницу оплаты"}
				</Footnote>
			)}

			<button
				type="button"
				className="pay-modal__cta"
				disabled={isLoading || !price || isSuccess || (isBalanceMerchant && !hasEnoughBalance)}
				onClick={handleSubmit}
				aria-busy={isLoading}
			>
				{isLoading ? (
					<>
						<Spinner />
						<span>{T("payment.loading") || "Загрузка..."}</span>
					</>
				) : (
					<>
						<span>{T("payment.buy")}</span>
						<ArrowRightIcon />
					</>
				)}
			</button>
		</div>
	)
}

export default PaymentModal
