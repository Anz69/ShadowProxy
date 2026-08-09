"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Plus, KeyRound, LifeBuoy } from "lucide-react"
import PageBackground from "@/shared/components/widgets/PageBackground"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { useMyPackages } from "@/features/packages/hooks/useMyPackages"
import TrafficChart from "@/features/dashboard/components/TrafficChart"
import ProxyGenerator from "@/features/dashboard/components/ProxyGenerator"
import RedeemKeyModal from "@/features/keys/components/RedeemKeyModal"
import { useMyReview } from "@/features/reviews/hooks/useReview"
import ReviewModal from "@/features/reviews/components/ReviewModal"
import ReviewSideWidget from "@/features/reviews/components/ReviewSideWidget"
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import type { Package } from "@/features/packages/types/packages.types"
import type { User } from "@/features/user/types/user.types"
import { formatTraffic } from "@/shared/utils/format-traffic"
import { formatSeconds } from "@/shared/utils/format-seconds"
import { userService } from "@/features/user/services/user.service"
import type { Prices } from "@/features/proxy/types/proxy.types"

type PackagePageClientProps = {
	packageData: Package
	user: User | null
	prices: Prices
	packageType: string // Тип прокси (тариф) из UserPackage
}

function renderStars(rating: number) {
	const stars = []
	for (let i = 1; i <= 5; i++) {
		stars.push(
			<path
				key={i}
				opacity={i <= rating ? 1 : 0.3}
				d={`M${6 + (i-1)*16}.33423 1.64893C${6.53214 + (i-1)*16} 1.00362 ${7.46786 + (i-1)*16} 1.00362 ${7.66577 + (i-1)*16} 1.64893L${8.38059 + (i-1)*16} 3.75309C${8.4804 + (i-1)*16} 4.05753 ${8.76245 + (i-1)*16} 4.26337 ${9.08455 + (i-1)*16} 4.26337H${11.332 + (i-1)*16}C${11.9938 + (i-1)*16} 4.26337 ${12.2679 + (i-1)*16} 5.11108 ${11.7332 + (i-1)*16} 5.50309L${9.96755 + (i-1)*16} 6.78801C${9.70131 + (i-1)*16} 6.98157 ${9.58978 + (i-1)*16} 7.32679 ${9.68959 + (i-1)*16} 7.63123L${10.4044 + (i-1)*16} 9.73539C${10.6023 + (i-1)*16} 10.3807 ${9.90447 + (i-1)*16} 10.9189 ${9.36974 + (i-1)*16} 10.5269L${7.60408 + (i-1)*16} 9.24198C${7.33784 + (i-1)*16} 9.04842 ${6.66216 + (i-1)*16} 9.04842 ${6.39592 + (i-1)*16} 9.24198L${4.63026 + (i-1)*16} 10.5269C${4.09553 + (i-1)*16} 10.9189 ${3.39767 + (i-1)*16} 10.3807 ${3.59558 + (i-1)*16} 9.73539L${4.31041 + (i-1)*16} 7.63123C${4.41022 + (i-1)*16} 7.32679 ${4.29869 + (i-1)*16} 6.98157 ${4.03245 + (i-1)*16} 6.78801L${2.26682 + (i-1)*16} 5.50309C${1.73209 + (i-1)*16} 5.11108 ${2.00625 + (i-1)*16} 4.26337 ${2.66801 + (i-1)*16} 4.26337H${4.91545 + (i-1)*16}C${5.23755 + (i-1)*16} 4.26337 ${5.5196 + (i-1)*16} 4.05753 ${5.61941 + (i-1)*16} 3.75309L${6.33423 + (i-1)*16} 1.64893Z`}
				fill="#f5b544"
			/>
		)
	}
	return stars
}

function getTrafficByPackageType(type: string, user: User | null, prices: Prices | null, T: (key: string) => string): string {
	if (!user) return "0 MB"
	
	let traffic: string | number = "0"
	let isIp = false
	
	if (type === "RESIDENT") {
		traffic = user.residentTrafficLeft
	} else if (type === "RESIDENT_PREMIUM") {
		traffic = user.premiumTrafficLeft
	} else if (type === "PREMIUM_RESIDENTIAL") {
		traffic = user.premiumResidentialTrafficLeft || "0"
	} else if (type === "MOBILE") {
		traffic = user.mobileTrafficLeft || "0"
	} else if (type === "ISP") {
		traffic = user.ispIpLeft
		isIp = true
	} else if (type === "MOBILE_GB") {
		traffic = user.mobileGbTrafficLeft
	} else if (type === "IPV6_GB") {
		traffic = user.ipv6GbTrafficLeft
	} else if (type === "ISP_USA") {
		traffic = user.ispUsaTrafficLeft || "0"
	} else if (type === "ISP_EU") {
		traffic = user.ispEuTrafficLeft || "0"
	} else if (type === "RESIDENTIAL_LITE") {
		traffic = user.residentialLiteTrafficLeft || "0"
	}

	if (isIp) {
		if (typeof traffic === "number" && traffic === 0) {
			return "0 MB"
		}
		return `${traffic} IP`
	} else {
		const trafficBigInt = BigInt(String(traffic))
		if (trafficBigInt === BigInt(0)) {
			return "0 MB"
		}
		return formatTraffic(String(traffic))
	}
}

function hasTraffic(type: string, user: User | null): boolean {
	if (!user) return false
	
	let traffic: string | number = "0"
	
	if (type === "RESIDENT") {
		traffic = user.residentTrafficLeft
	} else if (type === "RESIDENT_PREMIUM") {
		traffic = user.premiumTrafficLeft
	} else if (type === "PREMIUM_RESIDENTIAL") {
		traffic = user.premiumResidentialTrafficLeft || "0"
	} else if (type === "MOBILE") {
		traffic = user.mobileTrafficLeft || "0"
	} else if (type === "ISP") {
		traffic = user.ispIpLeft
		return typeof traffic === "number" && traffic > 0
	} else if (type === "MOBILE_GB") {
		traffic = user.mobileGbTrafficLeft
	} else if (type === "IPV6_GB") {
		traffic = user.ipv6GbTrafficLeft
	} else if (type === "ISP_USA") {
		traffic = user.ispUsaTrafficLeft || "0"
	} else if (type === "ISP_EU") {
		traffic = user.ispEuTrafficLeft || "0"
	} else if (type === "RESIDENTIAL_LITE") {
		traffic = user.residentialLiteTrafficLeft || "0"
	}
	
	const trafficBigInt = BigInt(String(traffic))
	return trafficBigInt > BigInt(0)
}

export default function PackagePageClient({ packageData, user: initialUser, prices, packageType }: PackagePageClientProps) {
	const pathname = usePathname()
	const router = useRouter()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const { open } = useModalStore()
	const { userPackages } = useMyPackages()
	const { data: myReview } = useMyReview()
	const canLeaveReview =
		!myReview?.hasReview &&
		!!myReview?.eligible &&
		!myReview?.reviewDiscountGranted
	
	const [user, setUser] = useState<User | null>(initialUser)

	useEffect(() => {
		if (!initialUser) return

		const updateUserData = async () => {
			try {
				const updatedUser = await userService.getMe()
				setUser(updatedUser)
			} catch (error) {
				console.error("Ошибка при обновлении данных пользователя:", error)
			}
		}

		updateUserData()
		const interval = setInterval(updateUserData, 60000)
		return () => clearInterval(interval)
	}, [initialUser])

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const currentUserPackage = userPackages && Array.isArray(userPackages) ? userPackages.find((up: any) => up.id === packageData.id) : null
	const activeProxies = currentUserPackage?.activeProxies || []
	
	const getLocalizedPath = (path: string) => {
		return addLocaleToPath(path, currentLocale)
	}

	const getPackageTitle = () => {
		switch (packageType) {
			case "RESIDENT":
			case "RESIDENT_PREMIUM":
				return T("package.packageTypes.resident")
			case "PREMIUM_RESIDENTIAL":
				return T("package.packageTypes.premiumResidential")
			case "MOBILE":
			case "MOBILE_GB":
				return T("package.packageTypes.mobile")
			case "IPV6_GB":
				return T("package.packageTypes.ipv6")
			case "ISP":
				return T("package.packageTypes.isp")
			case "ISP_USA":
				return T("package.packageTypes.ispUsa")
			case "ISP_EU":
				return T("package.packageTypes.ispEu")
			case "RESIDENTIAL_LITE":
				return T("package.packageTypes.residentialLite")
			default:
				return T("package.packageTypes.default")
		}
	}

	const getPackageTypeLabel = () => {
		switch (packageType) {
			case "RESIDENT":
				return "Delvin 23"
			case "RESIDENT_PREMIUM":
				return "Residential Proxy"
			case "PREMIUM_RESIDENTIAL":
				return "Premium Residential"
			case "MOBILE":
				return "Mobile Proxy"
			case "MOBILE_GB":
				return "Mobile GB"
			case "ISP":
				return "ISP"
			default:
				return "Unknown"
		}
	}

	const stars = packageType === "RESIDENT" ? 3 : packageType === "RESIDENT_PREMIUM" ? 4 : 0
	const showStars = stars > 0
	
	const getRatingText = () => {
		switch (packageType) {
			case "RESIDENT":
			case "RESIDENT_PREMIUM":
				return T("package.quality")
			case "MOBILE":
			case "MOBILE_GB":
				return T("package.mobileGb")
			case "IPV6_GB":
				return T("package.ipv6Rotation")
			case "ISP":
				return T("package.ispFixed")
			default:
				return ""
		}
	}

	const isActive = hasTraffic(packageType, user)

	const handleReplenish = () => {
		let tariff = "RESIDENT"
		if (packageType === "RESIDENT_PREMIUM") tariff = "RESIDENT_PREMIUM"
		else if (packageType === "IPV6_GB") tariff = "IPV6"
		else if (packageType === "MOBILE_GB") tariff = "MOBILE"
		else if (packageType === "MOBILE") tariff = "MOBILE"
		else if (packageType === "PREMIUM_RESIDENTIAL") tariff = "PREMIUM_RESIDENTIAL"
		router.push(`${getLocalizedPath("/payment")}?tariff=${tariff}`)
	}

	return (
		<main className="relative w-full overflow-hidden text-white light:text-[#0e1019]">
			<PageBackground />
			<ReviewSideWidget />
			<div className="relative z-[1] flex w-full flex-col gap-5 py-[clamp(20px,3vw,40px)]">
				<h1 className="font-[TalosDisplay] text-[clamp(26px,4vw,40px)] font-bold leading-[1.05] text-white light:text-[#0e1019]">
					{T("package.title")}
				</h1>

				{/* Premium summary card */}
				<div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(120deg,#0f1f44_0%,#0b1530_45%,#0a1020_100%)] p-6 sm:p-7 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] light:border-[#e6e8ef] light:bg-none light:bg-white light:shadow-[0_30px_70px_-44px_rgba(14,16,25,0.16)]">
					<span aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(47,107,255,0.42),transparent_68%)] blur-2xl light:bg-[radial-gradient(circle,rgba(47,107,255,0.12),transparent_70%)]" />
					<span aria-hidden className="pointer-events-none absolute -left-10 bottom-[-40%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(52,211,238,0.16),transparent_66%)] blur-2xl light:hidden" />

					<div className="relative z-[1] flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex flex-col items-start gap-4">
							{getRatingText() && (
								<div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 light:border-[#e2e4ea] light:bg-[#f4f6fa]">
									<span className="text-[12px] font-medium text-white/70 light:text-[#475467]">{getRatingText()}</span>
									{showStars && (
										<svg width="80" height="16" viewBox="0 0 80 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="-mb-0.5">
											{renderStars(stars)}
										</svg>
									)}
								</div>
							)}

							<h3 className="font-[TalosDisplay] text-[clamp(24px,3vw,32px)] font-bold leading-none text-white light:text-[#0e1019]">
								{getPackageTitle()}
							</h3>

							<div className="flex flex-wrap items-center gap-2.5">
								<div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 light:border-[#e2e4ea] light:bg-[#f4f6fa]">
									<span className="text-[13px] text-white/45 light:text-[#8a93a3]">
										{packageType === "IPV6_GB" ? T("package.ipCount") : T("package.trafficLeft")}
									</span>
									<span className="font-[TalosDisplay] text-[15px] font-bold text-white light:text-[#0e1019]">
										{getTrafficByPackageType(packageType, user, prices, T)}
									</span>
								</div>

								{isActive ? (
									<span className="inline-flex items-center gap-2 rounded-xl border border-[#34d399]/25 bg-[#34d399]/[0.12] px-3.5 py-2 text-[13px] font-semibold text-[#34d399] light:border-[#16a34a]/20 light:bg-[#16a34a]/10 light:text-[#16a34a]">
										<span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
										{T("package.active")}
									</span>
								) : (
									<span className="inline-flex items-center gap-1.5 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/[0.14] px-3.5 py-2 text-[13px] font-semibold text-[#fbbf24] light:border-[#f59e0b]/25 light:bg-[#f59e0b]/[0.14] light:text-[#d97706]">
										<AlertCircle size={15} />
										Пакет закончился
									</span>
								)}
							</div>
						</div>

						<div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col xl:flex-row">
							<button
								type="button"
								onClick={handleReplenish}
								className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_16px_44px_-14px_rgba(59,130,246,0.85)] transition-transform duration-200 hover:-translate-y-0.5"
							>
								<Plus className="h-[18px] w-[18px]" strokeWidth={2.6} />
								{T("package.replenishGb")}
							</button>
							<button
								type="button"
								onClick={() => open(<RedeemKeyModal />)}
								className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-white/12 light:border-[#e2e4ea] light:bg-[#f4f6fa] light:text-[#0e1019] light:hover:bg-[#eef1f6]"
							>
								<KeyRound className="h-[18px] w-[18px] text-[#6aa5ff] light:text-[#2f6bff]" strokeWidth={2.2} />
								{T("package.activateKey")}
							</button>
						</div>
					</div>
				</div>

				{/* Chart + generator */}
				<div className="grid grid-cols-1 items-stretch gap-5 2xl:grid-cols-[1.25fr_1fr]">
					<TrafficChart packageId={packageData.id} />
					<ProxyGenerator packageId={packageData.id} existingProxies={activeProxies} packageType={packageType} />
				</div>

				{/* ТЗ 1.3: баннер «Нужна помощь?» на странице генерации — glass, ненавязчиво */}
				<Link
					href={getLocalizedPath("/support")}
					className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-[20px] border border-[#6aa5ff]/25 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(59,130,246,0.14),transparent_55%),linear-gradient(180deg,#0e1830,#0a1020)] p-5 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-[#6aa5ff]/45 light:border-[#2f6bff]/20 light:bg-none light:bg-white"
				>
					<span aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(47,107,255,0.4),transparent_70%)] blur-[50px]" />
					<div className="relative z-[1] flex items-center gap-4">
						<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#6aa5ff]/30 bg-[#6aa5ff]/10 text-[#6aa5ff]">
							<LifeBuoy className="h-6 w-6" />
						</span>
						<div className="flex flex-col">
							<span className="font-[TalosDisplay] text-[17px] font-semibold text-white light:text-[#0e1019]">
								{T("support.banner.title")}
							</span>
							<span className="text-[13px] text-white/45 light:text-[#8a93a3]">
								{T("support.banner.subtitle")}
							</span>
						</div>
					</div>
					<span className="relative z-[1] inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform group-hover:-translate-y-0.5">
						{T("support.banner.cta")}
					</span>
				</Link>
			</div>
		</main>
	)
}

