"use client"

import { usePathname, useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { type FC, useState, useMemo, useEffect, useCallback } from "react"

import type { Plan, Prices } from "@/features/proxy/types/proxy.types"
import type { ExchangeRates } from "@/features/payments/types/payment.types"
import type { User } from "@/features/user/types/user.types"

import Button from "@/shared/components/ui/Button"
import Continent from "@/shared/components/widgets/Continent"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import {
	type ContinentCode,
	continentNames,
	countriesByContinent
} from "@/shared/utils/countries-by-continent"
import { formatSeconds } from "@/shared/utils/format-seconds"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import PaymentModal from "./PaymentModal"
import { useMobilePayment } from "@/features/payments/hooks/useMobilePayment"
import type { Merchant, AvailableAssets } from "@/features/payments/types/payment.types"

type PaymentTimeProps = {
	locations: string[]
	plans: Plan[]
	prices: Prices
	exchangeRates: ExchangeRates
	user?: User | null
}

const PaymentTime: FC<PaymentTimeProps> = ({
	locations,
	plans,
	prices,
	exchangeRates,
	user
}) => {
	const pathname = usePathname()
	const router = useRouter()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)
	const isOpen = useModalStore((s) => s.isOpen)
	const updateContent = useModalStore((s) => s.updateContent)
	const openModal = useModalStore((s) => s.open)
	const closeModal = useModalStore((s) => s.close)
	const { createInvoice, isLoading } = useMobilePayment()

	const searchParams = useSearchParams()
	const packageId = searchParams.get("packageId")
	
	const [selectedCountry, setSelectedCountry] = useState("")
	const [plan, setPlan] = useState<string | null>(null)
	const [rentTime, setRentTime] = useState((prices.mobile_legacy_options || [])[0]?.rentTime || 300)
	const [merchant, setMerchant] = useState<Merchant>("CRYPTO_BOT")
	const [asset, setAsset] = useState<AvailableAssets>("USDT")
	const [error, setError] = useState("")
	const [isSuccess, setIsSuccess] = useState(false)
	const [isLoadingPackage, setIsLoadingPackage] = useState(false)
	const [isReplenishMode, setIsReplenishMode] = useState(false)
	const [packageInfo, setPackageInfo] = useState<{ id: string; planId: string; countryCode: string; planName: string } | null>(null)
	
	// Загружаем данные пакета если передан packageId
	useEffect(() => {
		if (packageId && user) {
			setIsLoadingPackage(true)
			fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/package/${packageId}/info`, {
				credentials: "include",
			})
				.then(res => res.json())
				.then((data: { id: string; planId: string; rentTime: number; remainingSeconds: number | null }) => {
					if (data.planId) {
						const packagePlan = plans.find(p => p.id === data.planId)
						if (packagePlan) {
							setSelectedCountry(packagePlan.countryCode)
							setPlan(packagePlan.id)
							setIsReplenishMode(true)
							setPackageInfo({
								id: data.id,
								planId: data.planId,
								countryCode: packagePlan.countryCode,
								planName: packagePlan.name
							})
						}
					}
				})
				.catch(() => {
					setError(T("payment.packageLoadError") || "Ошибка загрузки данных пакета")
				})
				.finally(() => {
					setIsLoadingPackage(false)
				})
		}
	}, [packageId, user, plans])

	const handleCountryChange = (loc: string) => {
		if (isReplenishMode) return // Блокируем изменение в режиме пополнения
		setSelectedCountry(loc)
		const countryPlans = plans.filter(el => el.countryCode === loc)
		setPlan(countryPlans[0]?.id || null)
	}

	const selectedPrice = (prices.mobile_legacy_options || []).find(el => el.rentTime === rentTime)?.price || 0

	const calculateAssetPrice = (price: number) => {
		if (asset.startsWith("USD")) {
			return price
		}
		return price / exchangeRates[asset as Exclude<AvailableAssets, "USDT" | "USDC">]
	}

	const assetPrice = calculateAssetPrice(selectedPrice)

	const handleBuy = () => {
		if (!plan || !selectedCountry) {
			setError(T("payment.selectCountryAndOperator"))
			return
		}

		setError("")
		setIsSuccess(false)

		createInvoice(
			{
				planId: plan,
				rentTime,
				asset,
				merchant
			},
			{
				onSuccess: data => {
					setIsSuccess(true)
					if (data.paymentUrl) {
						window.open(data.paymentUrl, "_blank")
					}
				},
				onError: e => setError(e.message)
			}
		)
	}

	const getPaymentModalContent = useCallback(
		() => (
			<PaymentModal
				tariff="MOBILE"
				traffic={0}
				packages={[]}
				prices={prices}
				exchangeRates={exchangeRates}
				merchant={merchant}
				setMerchant={setMerchant}
				asset={asset}
				setAsset={setAsset}
				price={selectedPrice}
				assetPrice={assetPrice}
				onSubmit={({ merchant: m, asset: a }) => {
					if (m) setMerchant(m)
					if (a) setAsset(a)
					createInvoice(
						{
							planId: plan!,
							rentTime,
							asset: a || asset,
							merchant: m || merchant,
							userPackageId: packageId || undefined
						},
						{
							onSuccess: data => {
								setIsSuccess(true)
								if (data.paymentUrl) {
									window.open(data.paymentUrl, "_blank")
								} else if (data.userPackageId) {
									router.push(addLocaleToPath(`/packages/${data.userPackageId}`, locale))
								}
							},
							onError: e => setError(e.message)
						}
					)
				}}
				isLoading={isLoading}
				isSuccess={isSuccess}
				error={error}
				clearError={() => setError("")}
				mobileData={{
					planId: plan!,
					rentTime,
					country: selectedCountry,
					planName: plans.find(p => p.id === plan)?.name
				}}
				user={user}
			/>
		),
		[plan, rentTime, packageId, prices, exchangeRates, merchant, asset, selectedPrice, assetPrice, selectedCountry, plans, createInvoice, isLoading, isSuccess, error, locale, router, user]
	)

	const handleOpenPaymentModal = () => {
		if (!plan || !selectedCountry) {
			setError(T("payment.selectCountryAndOperator"))
			return
		}
		openModal(getPaymentModalContent())
	}

	// Обновляем контент модалки при изменении isSuccess/error/isLoading, чтобы отобразить уведомление
	useEffect(() => {
		if (isOpen) {
			updateContent(getPaymentModalContent())
		}
	}, [isOpen, isLoading, isSuccess, error, getPaymentModalContent, updateContent])

	// Закрываем модалку при успешной оплате
	useEffect(() => {
		if (isOpen && isSuccess) {
			closeModal()
		}
	}, [isOpen, isSuccess, closeModal])


	return (
		<div className="flex w-full flex-col gap-6">
			<h1 className="text-body text-[52px] font-semibold">
				{T("payment.selectTariff")}
			</h1>

			{/* Блок с информацией о пакете (если это пополнение) */}
			{isReplenishMode && packageInfo && (
				<div className="bg-white/10 rounded-xl p-6 flex w-full flex-col gap-2">
					<span className="text-white text-[32px] font-semibold">
						{T("payment.selectedRegion")}
					</span>
					<div className="flex flex-col gap-1">
						<span className="text-white/80 text-lg font-medium">
							{T("payment.package")}: {packageInfo.id}
						</span>
						<span className="text-white/60 text-base">
							{packageInfo.planName} ({packageInfo.countryCode.toUpperCase()})
						</span>
					</div>
				</div>
			)}

			<div className="flex w-full flex-col md:flex-row gap-4">
				{/* Блок выбора стран - 2/4 ширины */}
				<div className="bg-white/10 rounded-xl p-10 flex w-full md:w-2/4 flex-col gap-2">
					<span className="text-white text-[32px] font-semibold">
						{isReplenishMode ? T("payment.selectedRegion") : T("payment.selectRegion")}
					</span>
					<div className="flex w-full flex-col gap-2">
						{Object.entries(continentNames).map((el, idx) => {
							const countries = locations
								.filter(loc =>
									countriesByContinent[
										el[0] as ContinentCode
									].includes(loc.toUpperCase())
								)
								.filter(el =>
									plans.map(el => el.countryCode).includes(el)
								)

							return (
								<Continent
									label={el[1]}
									key={el[0]}
									countries={countries}
									isOpenedByDefault={idx <= 1 && !!countries.length}
									selectedCountry={selectedCountry}
									onChange={handleCountryChange}
									noBorder={true}
									cardBgColor="rgba(255, 255, 255, 0.1)"
									labelColor="text-white"
									continentBgColor="rgba(255, 255, 255, 0.1)"
									continentCode={el[0]}
									disabled={isReplenishMode}
								/>
							)
						})}
					</div>
				</div>

				{/* Блок выбора оператора - 1/4 ширины */}
				<div className="bg-white/10 rounded-xl p-10 flex w-full md:w-1/4 flex-col gap-2">
					<span className="text-white text-[32px] font-semibold">
						{T("payment.operator")}
					</span>
					<div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto operator-scrollbar">
						{plans
							.filter(el => el.countryCode === selectedCountry)
							.map(el => (
								<div
									onClick={() => !isReplenishMode && setPlan(el.id)}
									key={el.id}
									className={`${el.id === plan ? "border-[#0067FF] border-2" : "border-none"} bg-white/10 flex w-full ${isReplenishMode ? "cursor-not-allowed opacity-60" : "cursor-pointer"} flex-col items-start gap-1 rounded-xl p-4 duration-200 ${isReplenishMode ? "" : "hover:brightness-90"}`}
								>
									<span className="text-white text-base font-semibold">
										{el.name}
									</span>
									{!!el.description.trim().length && (
										<p className="text-white/50 text-sm font-medium whitespace-pre-wrap">
											{el.description}
										</p>
									)}
									<button
										type="button"
										disabled={el.id === plan || isReplenishMode}
										onClick={(e) => {
											e.stopPropagation()
											if (!isReplenishMode) {
												setPlan(el.id)
											}
										}}
										className={`w-full bg-white text-back rounded-xl px-4 py-1.5 text-base font-semibold leading-4 h-10 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-90 active:brightness-75 duration-200 ease-in-out mt-2 ${el.id === plan ? "cursor-not-allowed" : "cursor-pointer"}`}
									>
										{el.id === plan && (
											<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M13.3327 4L5.99935 11.3333L2.66602 8" stroke="#0067FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
											</svg>
										)}
										{T("payment.select") || "Выбрать"}
									</button>
								</div>
							))}
					</div>
				</div>

				{/* Блок выбора времени - 1/4 ширины */}
				<div className="bg-white/10 rounded-xl p-10 flex w-full md:w-1/4 flex-col gap-2">
					<span className="text-white text-[32px] font-semibold">
						{T("payment.rentTimeTitle")}
					</span>
					<div className="border border-white/20 rounded-xl overflow-hidden max-h-[600px] overflow-y-auto p-1">
						{(prices.mobile_legacy_options || []).map((el, index) => {
							const isSelected = rentTime === el.rentTime
							const isPrevSelected = index > 0 && rentTime === (prices.mobile_legacy_options || [])[index - 1].rentTime
							const isNextSelected = index < (prices.mobile_legacy_options || []).length - 1 && rentTime === (prices.mobile_legacy_options || [])[index + 1].rentTime
							const showDivider = index < (prices.mobile_legacy_options || []).length - 1 && !isSelected && !isNextSelected
							
							return (
								<div key={el.rentTime} className={isSelected ? "relative z-10" : ""}>
									<button
										type="button"
										onClick={() => setRentTime(el.rentTime)}
										className={`w-full px-4 py-3 text-center flex items-center justify-center gap-3 hover:rounded-lg transition-colors ${
											isSelected
												? "bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg"
												: "text-white/80 hover:bg-white/10"
										}`}
									>
										<span className="text-base font-medium">
											{formatSeconds(el.rentTime)}
										</span>
									</button>
									{showDivider && (
										<div className="border-b border-white/20 mx-4" />
									)}
								</div>
							)
						})}
					</div>
				</div>
			</div>

			{/* Итого и кнопка */}
			<div className="flex w-full flex-row items-end justify-between gap-2 border-t border-white/20 pt-4">
				<span className="text-white/30 text-2xl font-semibold md:text-3xl">
					{T("payment.total")}
				</span>
				<span className="text-body text-xl font-semibold md:text-2xl">
					{selectedPrice.toFixed(2)}$
				</span>
			</div>

			{error && (
				<div className="text-error text-base font-medium">
					{error}
				</div>
			)}

			<Button
				variant="white"
				type="button"
				disabled={!plan || !selectedCountry || isLoading}
				className="px-9 py-3 w-full"
				onClick={handleOpenPaymentModal}
			>
				{T("payment.buy")}
			</Button>
		</div>
	)
}

export default PaymentTime

