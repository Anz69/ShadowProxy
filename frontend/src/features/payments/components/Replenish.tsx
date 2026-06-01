"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { usePathname, useSearchParams } from "next/navigation"
import { type FC, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"

import type { Package as PackageType } from "@/features/packages/types/packages.types"
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
import Reveals from "@/shared/anim/Reveals"
import { formatPrice } from "@/shared/utils/format-price"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

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
		isLoading
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

	// Устанавливаем тариф из URL параметра при загрузке страницы
	useEffect(() => {
		const tariffParam = searchParams.get("tariff")
		if (tariffParam && ["RESIDENT_PREMIUM", "PREMIUM_RESIDENTIAL", "MOBILE", "MOBILE_GB", "IPV6"].includes(tariffParam)) {
			setTariff(tariffParam as "RESIDENT_PREMIUM" | "PREMIUM_RESIDENTIAL" | "MOBILE" | "MOBILE_GB" | "IPV6")
		}
	}, [searchParams, setTariff])

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
		<div className="flex w-full flex-col gap-6">
			<Reveals
				config={[
					{ selector: ".proxy-tier-group", stagger: 0.12, amount: 0.05 },
					{ selector: ".traffic-input-v2", variant: "up", amount: 0.05 },
					{ selector: ".pay-summary", variant: "up", amount: 0.05 },
					{ selector: ".pay-cta", variant: "up", amount: 0.05 }
				]}
			/>
			<h1 className="text-body text-[52px] font-semibold">{T("payment.pageTitle")}</h1>
			<div className="flex w-full flex-col items-start gap-2 md:flex-row md:gap-2">
				<div className="flex-1 w-full">
					<div className="pay-shell">
						<h2 className="pay-shell__title">{T("payment.title")}</h2>

						<div className="proxy-tier-group">
							<div className="proxy-tier-group__head">
								<h3 className="proxy-tier-group__title">{T("main.proxyTypes.standardTitle")}</h3>
							</div>
							<div className="proxy-tier-group__grid">
								<ProxyTypeCard
									isActive={tariff === "RESIDENT_PREMIUM"}
									onSelect={() => setTariff("RESIDENT_PREMIUM")}
									label={T("payment.tariffTypes.resident")}
									price={`${formatPrice(prices.resident_premium)}$ / ${T("payment.units.gb")}`}
									description={T("payment.descriptions.resident")}
									icon="/tariff-resident.svg"
									tier="standard"
									locale={locale}
								/>
								<ProxyTypeCard
									isActive={tariff === "MOBILE"}
									onSelect={() => setTariff("MOBILE")}
									label={T("payment.tariffTypes.mobile")}
									price={`${formatPrice(typeof prices.mobile === "number" ? prices.mobile : 0)}$ / ${T("payment.units.gb")}`}
									description={T("payment.descriptions.mobile")}
									icon="/tariff-mobile-gb.svg"
									tier="standard"
									locale={locale}
								/>
							</div>
						</div>

						<div className="proxy-tier-group proxy-tier-group--premium-accent">
							<div className="proxy-tier-group__head">
								<h3 className="proxy-tier-group__title proxy-tier-group__title--premium">
									{T("main.proxyTypes.premiumTitle")}
								</h3>
								<span className="proxy-tier-group__badge">PREMIUM</span>
							</div>
							<div className="proxy-tier-group__grid">
								<ProxyTypeCard
									isActive={tariff === "PREMIUM_RESIDENTIAL"}
									onSelect={() => setTariff("PREMIUM_RESIDENTIAL")}
									label={T("payment.tariffTypes.premiumResidential")}
									price={`${formatPrice(prices.premium_residential || 0)}$ / ${T("payment.units.gb")}`}
									description={T("payment.descriptions.premiumResidential")}
									icon="/tariff-premium.svg"
									tier="premium"
									locale={locale}
								/>
								<ProxyTypeCard
									isActive={false}
									onSelect={() => {}}
									label={T("main.proxyTypes.premiumMobile.title")}
									price={T("main.proxyTypes.comingSoon")}
									description={T("main.proxyTypes.premiumMobile.description").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")}
									icon="/tariff-mobile-gb.svg"
									tier="premium"
									comingSoon
									locale={locale}
								/>
							</div>
						</div>

						<TrafficInput
							valueGb={watch("traffic")}
							onChangeGb={val => setValue("traffic", val, { shouldValidate: true })}
							error={errors.traffic?.message}
							locale={locale}
						/>

						<div className="pay-summary">
							{discountPct > 0 && (
								<div className="pay-summary__discount">
									<span className="pay-summary__discount-label">{T("payment.discountLabel")} −{discountPct}%</span>
									<span className="pay-summary__strike">{(price || 0).toFixed(2)}$</span>
								</div>
							)}
							<div className="pay-summary__row">
								<span className="pay-summary__total-label">{T("payment.total")}</span>
								<span className="pay-summary__total-value">{discountedPrice.toFixed(2)}$</span>
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
							className="pay-cta"
							onClick={handleOpenPaymentModal}
							aria-busy={isLoading}
						>
							{isLoading && <span className="pay-cta__spinner" aria-hidden="true" />}
							<span>{T("payment.buy")}</span>
						</button>
					</div>
				</div>
				<div className="h-full w-full md:w-auto">
					<TransactionHistory payments={payments} packages={packages} locale={locale} />
				</div>
			</div>
		</div>
	)
}

export default Replenish
