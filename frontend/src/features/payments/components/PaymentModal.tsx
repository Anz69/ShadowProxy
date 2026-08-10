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

const Spinner = () => <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />

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
		if (tariff === "IPV6" || tariff === "IPV6_GB") return T("payment.tariffTypes.ipv6")
		if (tariff === "PREMIUM_RESIDENTIAL") return T("payment.tariffTypes.premiumResidential")
		if (tariff === "ISP_USA") return T("payment.tariffTypes.ispUsa")
		if (tariff === "ISP_EU") return T("payment.tariffTypes.ispEu")
		if (tariff === "RESIDENTIAL_LITE") return T("payment.tariffTypes.residentialLite")
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

	const optionCls = (isActive: boolean) =>
		`flex items-center justify-between gap-2 rounded-[14px] border p-3 text-left transition-all ${
			isActive
				? "border-[#6aa5ff]/50 bg-[#2f6bff]/10 ring-1 ring-[#6aa5ff]/30"
				: "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] light:bg-[#f4f6fa] light:border-[#e2e4ea] light:hover:bg-[#eef1f6]"
		}`
	const markCls = (isActive: boolean) =>
		`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
			isActive ? "bg-[#4f8dff] text-white" : "border border-white/15 light:border-[#e2e4ea]"
		}`
	const summaryRow = "flex items-center justify-between"
	const summaryLabel = "text-white/45 text-sm light:text-[#8a93a3]"
	const summaryValue = "text-white text-sm font-medium light:text-[#0e1019]"

	return (
		<div className="flex w-full  flex-col gap-5">

			<header className="flex flex-col gap-2">
				<span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#6aa5ff]/30 bg-[#2f6bff]/10 px-3 py-1 text-xs font-semibold text-[#6aa5ff] light:border-[#2f6bff]/25 light:text-[#2f6bff]">
					<SparkIcon />
					{T("payment.pageTitle")}
				</span>
				<h2 className="font-[TalosDisplay] text-white text-2xl font-bold light:text-[#0e1019]">
					{isBalanceReplenish ? T("payment.balance") : T("payment.title")}
				</h2>
			</header>

			{/* ── Order summary ── */}
			<section className="flex flex-col gap-2.5 rounded-[16px] border border-white/[0.08] bg-white/[0.03] p-4 light:border-[#e2e4ea] light:bg-[#f4f6fa]">
				<div className={summaryRow}>
					<span className={summaryLabel}>
						{T("payment.tariffType") || "Тип тарифа"}
					</span>
					<span className={summaryValue}>{getTariffName()}</span>
				</div>

				{tariff === "MOBILE" && mobileData ? (
					<>
						<div className={summaryRow}>
							<span className={summaryLabel}>{T("payment.country") || "Страна"}</span>
							<span className={summaryValue}>
								{new Intl.DisplayNames(["ru"], { type: "region" }).of(mobileData.country.toUpperCase()) || mobileData.country}
							</span>
						</div>
						<div className={summaryRow}>
							<span className={summaryLabel}>Оператор</span>
							<span className={summaryValue}>{mobileData.planName || "Не выбран"}</span>
						</div>
						<div className={summaryRow}>
							<span className={summaryLabel}>{T("payment.rentTime") || "Срок аренды"}</span>
							<span className={summaryValue}>{formatSeconds(mobileData.rentTime)}</span>
						</div>
					</>
				) : tariff === "MOBILE" ? (
					<>
						<div className={summaryRow}>
							<span className={summaryLabel}>{T("payment.country") || "Страна"}</span>
							<span className="text-white/45 text-sm italic light:text-[#8a93a3]">
								{T("payment.selectCountry") || "Выберите страну"}
							</span>
						</div>
						<div className={summaryRow}>
							<span className={summaryLabel}>{T("payment.rentTime") || "Срок аренды"}</span>
							<span className="text-white/45 text-sm italic light:text-[#8a93a3]">
								{T("payment.selectRentTime") || "Выберите срок аренды"}
							</span>
						</div>
					</>
				) : isBalanceReplenish ? (
					<div className={summaryRow}>
						<span className={summaryLabel}>{T("payment.traffic")}</span>
						<span className={summaryValue}>{price.toFixed(2)}$</span>
					</div>
				) : (
					<div className={summaryRow}>
						<span className={summaryLabel}>{T("payment.traffic")}</span>
						<span className={summaryValue}>{traffic} {T("payment.units.gb")}</span>
					</div>
				)}
			</section>

			{/* ── Payment method ── */}
			<section className="flex flex-col gap-2.5">
				<span className="text-white/60 text-sm font-medium light:text-[#5b6472]">{T("payment.merchant")}</span>
				<div className="grid grid-cols-2 gap-2">
					{merchantOptions.map(opt => {
						const isActive = merchant === opt.key
						return (
							<button
								key={opt.key}
								type="button"
								onClick={(e) => { e.stopPropagation(); setMerchant(opt.key) }}
								className={optionCls(isActive)}
								aria-pressed={isActive}
							>
								<span className="flex min-w-0 items-center gap-2">
									{opt.icon && (
										<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] light:border-[#e2e4ea] light:bg-white">
											<Image src={opt.icon} alt="" width={20} height={20} />
										</span>
									)}
									<span className="flex min-w-0 flex-col">
										<span className="truncate text-white text-sm font-medium light:text-[#0e1019]">{opt.label}</span>
										{opt.balance !== undefined && (
											<span className="text-white/45 text-xs light:text-[#8a93a3]">{opt.balance.toFixed(2)}$</span>
										)}
									</span>
								</span>
								<span className={markCls(isActive)} aria-hidden="true">
									{isActive && <CheckIcon />}
								</span>
							</button>
						)
					})}
				</div>
			</section>

			{/* ── Currency (if non-balance) ── */}
			{!isBalanceMerchant && (
				<section className="flex flex-col gap-2.5">
					<span className="text-white/60 text-sm font-medium light:text-[#5b6472]">{T("payment.currency")}</span>
					<div className="grid grid-cols-2 gap-2">
						{availableAssets.map(({ value, label }) => {
							const isActive = asset === value
							return (
								<button
									key={value}
									type="button"
									onClick={(e) => { e.stopPropagation(); setAsset(value as AvailableAssets) }}
									className={optionCls(isActive)}
									aria-pressed={isActive}
								>
									<span className="flex min-w-0 items-center gap-2">
										<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] light:border-[#e2e4ea] light:bg-white">
											<Image src={`/crypto/${value.toLowerCase()}.svg`} alt={label} width={20} height={20} />
										</span>
										<span className="truncate text-white text-sm font-medium light:text-[#0e1019]">{label}</span>
									</span>
									<span className={markCls(isActive)} aria-hidden="true">
										{isActive && <CheckIcon />}
									</span>
								</button>
							)
						})}
					</div>
				</section>
			)}

			{/* ── Total HERO ── */}
			<section className="flex flex-col gap-1.5 rounded-[16px] border border-white/[0.08] bg-white/[0.03] p-4 light:border-[#e2e4ea] light:bg-[#f4f6fa]">
				{discountPct > 0 && (
					<div className="flex items-center justify-between text-sm">
						<span className="font-semibold text-[#6aa5ff] light:text-[#2f6bff]">
							{T("payment.discountLabel")} −{discountPct}%
						</span>
						<span className="text-white/40 line-through light:text-[#8a93a3]">{price.toFixed(2)}$</span>
					</div>
				)}
				<div className="flex items-baseline justify-between gap-3">
					<span className="text-white/60 text-base light:text-[#5b6472]">{T("payment.total")}</span>
					<span className="flex flex-wrap items-baseline justify-end gap-1.5 text-right font-[TalosDisplay] text-white text-2xl font-bold light:text-[#0e1019]">
						{isBalanceMerchant ? (
							<>{discountedPrice.toFixed(2)}$</>
						) : (
							<>
								{discountedAssetPrice.toFixed(asset.startsWith("USD") ? 2 : 5)} {asset}
								<span className="text-white/45 text-sm font-medium light:text-[#8a93a3]">({discountedPrice.toFixed(2)}$)</span>
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
				className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-7 py-3.5 text-white font-semibold shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
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
