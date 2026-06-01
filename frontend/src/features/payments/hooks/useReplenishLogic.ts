import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import type { UseFormSetError } from "react-hook-form"

import type {
	Package,
	Package as PackageType
} from "@/features/packages/types/packages.types"
import { useIspPayment } from "@/features/payments/hooks/useIspPayment"
import { usePackagePayment } from "@/features/payments/hooks/usePackagePayment"
import { useResidentPayment } from "@/features/payments/hooks/useResidentPayment"
import type {
	AvailableAssets,
	ExchangeRates,
	Invoice,
	Merchant,
	ResidentTariff
} from "@/features/payments/types/payment.types"
import type { Prices } from "@/features/proxy/types/proxy.types"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"

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
	const [tariff, setTariff] = useState<ResidentTariff | "MOBILE" | "MOBILE_GB" | "IPV6" | "PREMIUM_RESIDENTIAL">("RESIDENT_PREMIUM")
	const [merchant, setMerchant] = useState<Merchant>("CRYPTO_BOT")
	const [asset, setAsset] = useState<AvailableAssets>("USDT")
	const [isSuccess, setIsSuccess] = useState(false)
	const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(
		null
	)
	const [price, setPrice] = useState(0)
	const [assetPrice, setAssetPrice] = useState(0)
	const { createResidentInvoice, isResidentInvoiceLoading } =
		useResidentPayment()
	const { createPackageInvoice, isPackageInvoiceLoading } =
		usePackagePayment()
	const { createIspInvoice, isIspInvoiceLoading } = useIspPayment()

	useEffect(() => {
		setSelectedPackage(null)
		const filterType =
			tariff === "IPV6"
				? "ISP"
				: tariff === "MOBILE_GB"
					? "MOBILE_GB"
					: tariff === "MOBILE"
						? "MOBILE"
						: tariff === "PREMIUM_RESIDENTIAL"
							? "PREMIUM_RESIDENTIAL"
							: tariff
		const serializedPackages = packages
			.filter(el => el.type === filterType)
			.map(el => ({
				id: el.id,
				traffic: Number(BigInt(el.traffic) / BigInt(1024 ** 3)),
				price: el.price
			}))
		// Пакеты теперь = объёмы-пресеты без цены (price: 0). Цена считается
		// из тарификации, поэтому НЕ перехватываем расчёт пакетом с нулевой
		// ценой (иначе Итого = 0). Используем пакет как priced-бандл только
		// если у него реально задана цена (легаси-пакеты).
		const currentPackage = serializedPackages.find(
			el => el.traffic === traffic && Number(el.price) > 0
		)
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

		if (currentPackage) {
			setPrice(Number(currentPackage.price))
			calculateAssetPrice(Number(currentPackage.price))
			setSelectedPackage(
				packages.find(el => el.id === currentPackage.id)!
			)
		} else {
			const exchangeRate =
				tariff === "RESIDENT_PREMIUM"
					? prices.resident_premium
					: tariff === "PREMIUM_RESIDENTIAL"
						? (prices.premium_residential || 0)
						: tariff === "MOBILE_GB"
							? (prices.mobile_gb || 0)
							: tariff === "MOBILE"
								? (typeof prices.mobile === "number" ? prices.mobile : 0)
								: tariff === "IPV6"
									? prices.ipv6_gb
									: prices.ipv6_gb
			const price = traffic * exchangeRate
			setPrice(price)
			calculateAssetPrice(price)
		}
	}, [traffic, asset, tariff])

	const onSubmit = (dto: { traffic: number; merchant?: Merchant; asset?: AvailableAssets }) => {
		const options = {
			onSuccess: (data: Invoice<"package" | "resident" | "isp">) => {
				setIsSuccess(true)
				// Скидка могла сгореть (balance-оплата) / стать неприменимой —
				// обновляем единый источник, чтобы виджет и Итого не врали.
				queryClient.invalidateQueries({ queryKey: ["active-discount"] })
				queryClient.invalidateQueries({ queryKey: ["my-review"] })
				// Оплата с баланса (нет paymentUrl) — всегда уводим со страницы
				// оплаты в управление. userPackageId может прийти не сразу
				// (провижининг вынесен из транзакции), поэтому фолбэк — дашборд.
				if (!data.paymentUrl) {
					const target = data.userPackageId
						? `/packages/${data.userPackageId}`
						: "/dashboard"
					router.push(addLocaleToPath(target, currentLocale))
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

		if (selectedPackage) {
			createPackageInvoice(
				{
					package: selectedPackage.id,
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
			isPackageInvoiceLoading ||
			isIspInvoiceLoading
	}
}
