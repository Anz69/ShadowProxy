"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { usePathname, useSearchParams } from "next/navigation"
import { type FC, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"

import type { Package as PackageType } from "@/features/packages/types/packages.types"
import PackagePresetSelector from "@/features/payments/components/PackagePresetSelector"
import PaymentModal from "@/features/payments/components/PaymentModal"
import ProxyTypeCard from "@/features/payments/components/ProxyTypeCard"
import TrafficInput from "@/features/payments/components/TrafficInput"
import TransactionHistory from "@/features/payments/components/TransactionHistory"
import { useReplenishLogic } from "@/features/payments/hooks/useReplenishLogic"
import { useActiveDiscount } from "@/features/payments/hooks/useActiveDiscount"
import { orderResidentSchema } from "@/features/payments/schemas/order-resident.schema"
import type {
	ExchangeRates,
	Invoice
} from "@/features/payments/types/payment.types"
import type { Prices } from "@/features/proxy/types/proxy.types"
import type { User } from "@/features/user/types/user.types"

import Footnote from "@/shared/components/ui/Footnote"
import PageBackground from "@/shared/components/widgets/PageBackground"
import Reveals from "@/shared/anim/Reveals"
import { formatPrice } from "@/shared/utils/format-price"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { isProxyTypeDisabled } from "@/shared/constants/sprint-gating"

type ReplenishProps = {
	exchangeRates: ExchangeRates
	packages: PackageType[]
	prices: Prices
	payments: Invoice[]
	user?: User | null
}

const Replenish: FC<ReplenishProps> = ({
	exchangeRates,
	packages,
	prices,
	payments,
	user
}) => {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const isOpen = useModalStore((s) => s.isOpen)
	const updateContent = useModalStore((s) => s.updateContent)
	const openModal = useModalStore((s) => s.open)
	const closeModal = useModalStore((s) => s.close)

	const {
		watch,
		setValue,
		formState: { errors },
		setError,
		clearErrors
	} = useForm<{ traffic: number }>({
		resolver: zodResolver(orderResidentSchema),
		defaultValues: {
			traffic: 1
		}
	})
	const {
		tariff,
		setTariff,
		onSubmit,
		merchant,
		setMerchant,
		asset,
		setAsset,
		assetPrice,
		price,
		isSuccess,
		isLoading,
		availablePackages,
		selectedPackage,
		selectPackage,
		clearPackageSelection
	} = useReplenishLogic({
		traffic: watch("traffic"),
		setError,
		prices,
		packages,
		exchangeRates
	})

	// Часть 1.3: скидка за отзыв — показываем зачёркнутую цену → со скидкой.
	// Источник истины — бэк (GET /payments/active-discount), считает по lifecycle.
	const { data: activeDiscount } = useActiveDiscount(true)
	const discountPct = activeDiscount?.pct ?? 0
	const discountedPrice =
		discountPct > 0 ? (price || 0) * (1 - discountPct / 100) : price || 0
	const startingPrice = (
		key: keyof NonNullable<Prices["minimum_prices"]>,
		fallback: number
	) => {
		const minimum = prices.minimum_prices?.[key]
		const amount = typeof minimum === "number" && minimum > 0 ? minimum : fallback
		return `${T("package.from")} ${formatPrice(amount)}$ / ${T("payment.units.gb")}`
	}

	// Устанавливаем тариф из URL параметра при загрузке страницы
	useEffect(() => {
		const tariffParam = searchParams.get("tariff")
		if (tariffParam && !isProxyTypeDisabled(tariffParam) && ["RESIDENT_PREMIUM", "PREMIUM_RESIDENTIAL", "MOBILE", "MOBILE_GB", "IPV6", "ISP_USA", "ISP_EU", "RESIDENTIAL_LITE"].includes(tariffParam)) {
			setTariff(tariffParam as "RESIDENT_PREMIUM" | "PREMIUM_RESIDENTIAL" | "MOBILE" | "MOBILE_GB" | "IPV6" | "ISP_USA" | "ISP_EU" | "RESIDENTIAL_LITE")
		}
	}, [searchParams, setTariff])

	const handlePackageSelect = (packageId: string) => {
		const trafficGb = selectPackage(packageId)
		if (trafficGb !== null) {
			setValue("traffic", trafficGb, { shouldValidate: true, shouldDirty: true })
		}
	}

	const handleTrafficChange = (valueGb: number) => {
		clearPackageSelection()
		setValue("traffic", valueGb, { shouldValidate: true, shouldDirty: true })
	}

	const getPaymentModalContent = useCallback(
		() => (
			<PaymentModal
				tariff={tariff}
				traffic={watch("traffic")}
				packages={packages}
				prices={prices}
				exchangeRates={exchangeRates}
				merchant={merchant}
				setMerchant={setMerchant}
				asset={asset}
				setAsset={setAsset}
				price={price}
				assetPrice={assetPrice}
				onSubmit={onSubmit}
				isLoading={isLoading}
				isSuccess={isSuccess}
				error={errors.root?.message}
				clearError={() => clearErrors("root")}
				user={user}
			/>
		),
		[tariff, watch("traffic"), packages, prices, exchangeRates, merchant, asset, price, assetPrice, onSubmit, isLoading, isSuccess, errors.root?.message, user]
	)

	const handleOpenPaymentModal = () => {
		openModal(getPaymentModalContent())
	}

	// Обновляем контент модалки при изменении isSuccess/error/isLoading, чтобы отобразить уведомление
	useEffect(() => {
		if (isOpen) {
			updateContent(getPaymentModalContent())
		}
	}, [isOpen, isLoading, isSuccess, errors.root?.message, getPaymentModalContent, updateContent])

	// Закрываем модалку при успешной оплате
	useEffect(() => {
		if (isOpen && isSuccess) {
			closeModal()
		}
	}, [isOpen, isSuccess, closeModal])

	return (
		<div className="relative w-full overflow-hidden text-white light:text-[#0e1019]">
			<PageBackground />
			<div className="relative z-[1] flex w-full flex-col gap-5 py-[clamp(20px,3vw,40px)]">
				<Reveals
					config={[
						{ selector: ".proxy-tier-group", stagger: 0.12, amount: 0.05 },
						{ selector: ".traffic-input-v2", variant: "up", amount: 0.05 },
						{ selector: ".pay-summary", variant: "up", amount: 0.05 },
						{ selector: ".pay-cta", variant: "up", amount: 0.05 }
					]}
				/>
				<h1 className="font-[TalosDisplay] text-white light:text-[#0e1019] text-[clamp(26px,4vw,40px)] font-bold leading-[1.05]">{T("payment.pageTitle")}</h1>
				<div className="flex w-full flex-col items-start gap-6">
					<div className="flex-1 w-full">
						<div className="flex flex-col gap-5 rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-5 sm:p-6 shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] light:border-[#e6e8ef] light:bg-none light:bg-white light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.14)]">
							<h2 className="font-[TalosDisplay] text-white light:text-[#0e1019] text-xl font-bold">{T("payment.title")}</h2>

							<div className="proxy-tier-group flex flex-col gap-3">
								<div className="proxy-tier-group__head flex items-center gap-3">
									<h3 className="font-[TalosDisplay] text-white light:text-[#0e1019] text-lg font-semibold">{T("main.proxyTypes.standardTitle")}</h3>
								</div>
								<div className="proxy-tier-group__grid grid grid-cols-1 gap-3 sm:grid-cols-2">
									{!isProxyTypeDisabled("RESIDENT_PREMIUM") && <ProxyTypeCard
										isActive={tariff === "RESIDENT_PREMIUM"}
										onSelect={() => setTariff("RESIDENT_PREMIUM")}
										label={T("payment.tariffTypes.resident")}
										price={startingPrice("resident_premium", prices.resident_premium)}
										description={T("payment.descriptions.resident")}
										icon="/tariff-resident.svg"
										tier="standard"
										locale={locale}
									/>}
									{!isProxyTypeDisabled("RESIDENTIAL_LITE") && (
									<ProxyTypeCard
										isActive={tariff === "RESIDENTIAL_LITE"}
										onSelect={() => setTariff("RESIDENTIAL_LITE")}
										label={T("payment.tariffTypes.residentialLite")}
										price={startingPrice("residential_lite", prices.residential_lite || 0)}
										description={T("payment.descriptions.residentialLite")}
										icon="/tariff-resident.svg"
										tier="standard"
										locale={locale}
									/>
									)}
									<ProxyTypeCard
										isActive={tariff === "ISP_USA"}
										onSelect={() => setTariff("ISP_USA")}
										label={T("payment.tariffTypes.ispUsa")}
										price={startingPrice("isp_usa", prices.isp_usa || 0)}
										description={T("payment.descriptions.ispUsa")}
										icon="/tariff-resident.svg"
										tier="standard"
										locale={locale}
									/>
									{!isProxyTypeDisabled("ISP_EU") && (
									<ProxyTypeCard
										isActive={tariff === "ISP_EU"}
										onSelect={() => setTariff("ISP_EU")}
										label={T("payment.tariffTypes.ispEu")}
										price={startingPrice("isp_eu", prices.isp_eu || 0)}
										description={T("payment.descriptions.ispEu")}
										icon="/tariff-resident.svg"
										tier="standard"
										locale={locale}
									/>
									)}
								</div>
							</div>

							<div className="proxy-tier-group flex flex-col gap-3">
								<div className="proxy-tier-group__head flex items-center gap-3">
									<h3 className="font-[TalosDisplay] text-white light:text-[#0e1019] text-lg font-semibold">
										{T("main.proxyTypes.premiumTitle")}
									</h3>
									<span className="rounded-full border border-[#6aa5ff]/30 bg-[#2f6bff]/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#6aa5ff] light:border-[#2f6bff]/25 light:text-[#2f6bff]">PREMIUM</span>
								</div>
								<div className="proxy-tier-group__grid grid grid-cols-1 gap-3 sm:grid-cols-2">
									<ProxyTypeCard
										isActive={tariff === "PREMIUM_RESIDENTIAL"}
										onSelect={() => setTariff("PREMIUM_RESIDENTIAL")}
										label={T("payment.tariffTypes.premiumResidential")}
										price={startingPrice("premium_residential", prices.premium_residential || 0)}
										description={T("payment.descriptions.premiumResidential")}
										icon="/tariff-premium.svg"
										tier="premium"
										locale={locale}
									/>
									<ProxyTypeCard
										isActive={tariff === "MOBILE"}
										onSelect={() => setTariff("MOBILE")}
										label={T("main.proxyTypes.premiumMobile.title")}
										price={startingPrice("mobile", typeof prices.mobile === "number" ? prices.mobile : 0)}
										description={T("main.proxyTypes.premiumMobile.description").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")}
										icon="/tariff-mobile-gb.svg"
										tier="premium"
										locale={locale}
									/>
								</div>
							</div>

							{availablePackages.length > 0 && (
								<PackagePresetSelector
									packages={availablePackages}
									selectedPackageId={selectedPackage?.id ?? null}
									onSelect={handlePackageSelect}
									locale={locale}
								/>
							)}

							<TrafficInput
								valueGb={watch("traffic")}
								onChangeGb={handleTrafficChange}
								error={errors.traffic?.message}
								locale={locale}
							/>

							<div className="pay-summary flex flex-col gap-2 rounded-[16px] border border-white/[0.08] bg-white/[0.03] p-4 light:border-[#e6e8ef] light:bg-[#f4f6fa]">
								{discountPct > 0 && (
									<div className="flex items-center justify-between text-sm">
										<span className="font-semibold text-[#6aa5ff] light:text-[#2f6bff]">{T("payment.discountLabel")} −{discountPct}%</span>
										<span className="text-white/40 line-through light:text-[#9aa3b2]">{(price || 0).toFixed(2)}$</span>
									</div>
								)}
								<div className="flex items-center justify-between">
									<span className="text-white/60 light:text-[#5b6472] text-base">{T("payment.total")}</span>
									<span className="font-[TalosDisplay] text-white light:text-[#0e1019] text-3xl font-bold">{discountedPrice.toFixed(2)}$</span>
								</div>
							</div>

							{errors.root?.message && (
								<Footnote variant="error">{errors.root.message}</Footnote>
							)}
							{isSuccess && (
								<Footnote variant="success">{T("payment.successMessage")}</Footnote>
							)}

							<button
								type="button"
								disabled={!price || isLoading}
								className="pay-cta inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-7 py-3.5 text-white font-semibold shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
								onClick={handleOpenPaymentModal}
								aria-busy={isLoading}
							>
								{isLoading && <span className="pay-cta__spinner inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />}
								<span>{T("payment.buy")}</span>
							</button>
						</div>
					</div>
					<div className="w-full">
						<TransactionHistory payments={payments} packages={packages} locale={locale} />
					</div>
				</div>
			</div>
		</div>
	)
}

export default Replenish
