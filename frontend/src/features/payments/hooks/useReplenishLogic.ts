import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import type { UseFormSetError } from "react-hook-form"

import type { Package } from "@/features/packages/types/packages.types"
import { usePackagePayment } from "@/features/payments/hooks/usePackagePayment"
import { useResidentPayment } from "@/features/payments/hooks/useResidentPayment"
import type {
	AvailableAssets,
	ExchangeRates,
	Invoice,
	Merchant,
	ResidentTariff
} from "@/features/payments/types/payment.types"
import type { Prices, RechargeableProxyType } from "@/features/proxy/types/proxy.types"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"

type ReplenishTariff = ResidentTariff | "IPV6"

const packageTrafficGb = (pkg: Package): number =>
	Number(BigInt(pkg.traffic)) / 1024 ** 3

const packageTypeForTariff = (tariff: ReplenishTariff): RechargeableProxyType =>
	tariff === "IPV6" ? "IPV6_GB" : tariff as RechargeableProxyType

const pricePerGbForTariff = (tariff: ReplenishTariff, prices: Prices): number => {
	switch (tariff) {
		case "RESIDENT":
		case "RESIDENT_PREMIUM":
			return prices.resident_premium
		case "PREMIUM_RESIDENTIAL":
			return prices.premium_residential || 0
		case "MOBILE_GB":
			return prices.mobile_gb || 0
		case "MOBILE":
			return typeof prices.mobile === "number" ? prices.mobile : 0
		case "IPV6":
		case "IPV6_GB":
			return prices.ipv6_gb
		case "ISP_USA":
			return prices.isp_usa || 0
		case "ISP_EU":
			return prices.isp_eu || 0
		case "RESIDENTIAL_LITE":
			return prices.residential_lite || 0
		default:
			return 0
	}
}

type UseReplenishLogicProps = {
	packages: Package[]
	exchangeRates: ExchangeRates
	prices: Prices
	traffic: number
	setError: UseFormSetError<{ traffic: number }>
}

export function useReplenishLogic({
	packages,
	exchangeRates,
	prices,
	traffic,
	setError
}: UseReplenishLogicProps) {
	const router = useRouter()
	const pathname = usePathname()
	const queryClient = useQueryClient()
	const currentLocale = getLocaleFromPath(pathname)
	const [tariff, setTariffState] = useState<ReplenishTariff>("RESIDENT_PREMIUM")
	const [merchant, setMerchant] = useState<Merchant>("CRYPTO_BOT")
	const [asset, setAsset] = useState<AvailableAssets>("USDT")
	const [isSuccess, setIsSuccess] = useState(false)
	const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
	const [price, setPrice] = useState(0)
	const [assetPrice, setAssetPrice] = useState(0)
	const { createResidentInvoice, isResidentInvoiceLoading } =
		useResidentPayment()
	const { createPackageInvoice, isPackageInvoiceLoading } =
		usePackagePayment()
	const packageType = packageTypeForTariff(tariff)
	const availablePackages = useMemo(
		() =>
			packages
				.filter(pkg => pkg.type === packageType)
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
		[packages, packageType]
	)
	const selectedPackage = useMemo(
		() => availablePackages.find(pkg => pkg.id === selectedPackageId) ?? null,
		[availablePackages, selectedPackageId]
	)

	const setTariff = useCallback((nextTariff: ReplenishTariff) => {
		setSelectedPackageId(null)
		setTariffState(nextTariff)
	}, [])

	const selectPackage = (packageId: string): number | null => {
		const pkg = availablePackages.find(item => item.id === packageId)
		if (!pkg) return null
		setSelectedPackageId(pkg.id)
		return packageTrafficGb(pkg)
	}

	const clearPackageSelection = () => setSelectedPackageId(null)

	useEffect(() => {
		const packagePrice = selectedPackage ? Number(selectedPackage.price) : 0
		const hasMatchingPaidPackage =
			selectedPackage &&
			Math.abs(packageTrafficGb(selectedPackage) - traffic) < 0.0001 &&
			Number.isFinite(packagePrice) &&
			packagePrice > 0
		const nextPrice = hasMatchingPaidPackage
			? packagePrice
			: traffic * pricePerGbForTariff(tariff, prices)

		setPrice(nextPrice)
		if (asset.startsWith("USD")) {
			setAssetPrice(nextPrice)
		} else {
			setAssetPrice(
				nextPrice /
					exchangeRates[asset as Exclude<AvailableAssets, "USDT" | "USDC">]
			)
		}
	}, [asset, exchangeRates, prices, selectedPackage, tariff, traffic])

	const onSubmit = (dto: { traffic: number; merchant?: Merchant; asset?: AvailableAssets }) => {
		const options = {
			onSuccess: (data: Invoice<"package" | "resident" | "isp">) => {
				setIsSuccess(true)
				// Скидка могла сгореть (balance-оплата) / стать неприменимой —
				// обновляем единый источник, чтобы виджет и Итого не врали.
				queryClient.invalidateQueries({ queryKey: ["active-discount"] })
				queryClient.invalidateQueries({ queryKey: ["my-review"] })
				// Список купленных пакетов — после покупки появляется новый пакет /
				// меняется остаток трафика, иначе на дашборде статусы устаревшие.
				queryClient.invalidateQueries({ queryKey: ["user-packages"] })
				// Оплата с баланса (нет paymentUrl) — всегда уводим со страницы
				// оплаты в управление. userPackageId может прийти не сразу
				// (провижининг вынесен из транзакции), поэтому фолбэк — дашборд.
				if (!data.paymentUrl) {
					const target = data.userPackageId
						? `/packages/${data.userPackageId}`
						: "/dashboard"
					router.push(addLocaleToPath(target, currentLocale))
					// Дашборд — серверный компонент (баланс/трафик/пользователь
					// рендерятся на сервере). Без refresh() они берутся из кеша и
					// обновляются только при ручной перезагрузке. Ревалидируем.
					router.refresh()
				} else {
					// Обычная оплата через мерчанта
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

		const billablePackage =
			selectedPackage && Number(selectedPackage.price) > 0
				? selectedPackage
				: null

		if (billablePackage) {
			createPackageInvoice(
				{
					package: billablePackage.id,
					asset: finalAsset,
					merchant: finalMerchant
				},
				options
			)
		} else {
			if (tariff === "MOBILE") {
				createResidentInvoice(
					{
						tariff: "MOBILE",
						traffic: dto.traffic,
						asset: finalAsset,
						merchant: finalMerchant
					},
					options
				)
			} else if (tariff === "MOBILE_GB") {
				createResidentInvoice(
					{
						tariff: "MOBILE_GB",
						traffic: dto.traffic,
						asset: finalAsset,
						merchant: finalMerchant
					},
					options
				)
			} else if (tariff === "IPV6") {
				createResidentInvoice(
					{
						tariff: "IPV6_GB",
						traffic: dto.traffic,
						asset: finalAsset,
						merchant: finalMerchant
					},
					options
				)
			} else if (tariff === "PREMIUM_RESIDENTIAL") {
				createResidentInvoice(
					{
						tariff: "PREMIUM_RESIDENTIAL",
						traffic: dto.traffic,
						asset: finalAsset,
						merchant: finalMerchant
					},
					options
				)
			} else {
				createResidentInvoice(
					{
						tariff,
						traffic: dto.traffic,
						asset: finalAsset,
						merchant: finalMerchant
					},
					options
				)
			}
		}
	}

	return {
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
			isLoading:
				isResidentInvoiceLoading ||
				isPackageInvoiceLoading,
			availablePackages,
			selectedPackage,
			selectPackage,
			clearPackageSelection
	}
}
