"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
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
				fill="#FFFFFF"
			/>
		)
	}
	return stars
}

function getTrafficByPackageType(type: string, user: User | null, prices: Prices | null, T: (key: string) => string): string {
	if (!user) return "0 мб"
	
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
	}

	if (isIp) {
		if (typeof traffic === "number" && traffic === 0) {
			return "0 мб"
		}
		return `${traffic} IP`
	} else {
		const trafficBigInt = BigInt(String(traffic))
		if (trafficBigInt === BigInt(0)) {
			return "0 мб"
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

	return (
		<main className="pc-proxy-package">
			<ReviewSideWidget />
			<div className="pc-proxy-package__container">
				<h1 className="pc-proxy-package__title">{T("package.title")}</h1>

				<div className="pc-proxy-package__main-block">
					<div className="pc-proxy-package__data">
						{showStars && (
							<div className="proxy-package-badge">
								<span className="badge-text">{getRatingText()}</span>
								<div className="rating-stars">
									<svg width="80" height="16" viewBox="0 0 80 16" fill="none" xmlns="http://www.w3.org/2000/svg">
										{renderStars(stars)}
									</svg>
								</div>
							</div>
						)}
						{!showStars && getRatingText() && (
							<div className="proxy-package-badge">
								<span className="badge-text">{getRatingText()}</span>
							</div>
						)}

						<h3 className="proxy-package-title">{getPackageTitle()}</h3>

						<div className="proxy-package-data">
							<div className="data-row">
								<span className="data-label">
									{packageType === "IPV6_GB"
										? T("package.ipCount")
										: T("package.trafficLeft")}
								</span>
								<span className="data-value">
									{getTrafficByPackageType(packageType, user, prices, T)}
								</span>
							</div>
							<div className="data-row">
								<span className="data-label">{T("package.status")}</span>
								{hasTraffic(packageType, user) ? (
									<span className="data-value">{T("package.active")}</span>
								) : (
									<span className="data-value" style={{
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										gap: "6px",
										backgroundColor: "#FFD964",
										color: "#222222",
										padding: "0 10px",
										height: "24px",
										borderRadius: "8px",
										fontSize: "12px",
										fontWeight: 500,
										lineHeight: "1.3",
										letterSpacing: "-0.01em"
									}}>
										<AlertCircle size={16} style={{ opacity: 0.5 }} />
										Пакет закончился
									</span>
								)}
							</div>
						</div>
					</div>

					<div className="pc-proxy-package__actions">
						<button 
							className="pc-proxy-package__action-btn"
							onClick={() => {
								let tariff = "RESIDENT"
								if (packageType === "RESIDENT_PREMIUM") {
									tariff = "RESIDENT_PREMIUM"
								} else if (packageType === "IPV6_GB") {
									tariff = "IPV6"
								} else if (packageType === "MOBILE_GB") {
									// legacy: редиректим на новый Mobile (PE) — задача 4 ТЗ
									tariff = "MOBILE"
								} else if (packageType === "MOBILE") {
									tariff = "MOBILE"
								} else if (packageType === "PREMIUM_RESIDENTIAL") {
									tariff = "PREMIUM_RESIDENTIAL"
								}
								router.push(`${getLocalizedPath('/payment')}?tariff=${tariff}`)
							}}
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17 13H13V17H11V13H7V11H11V7H13V11H17V13Z" fill="#0067FF"/>
							</svg>
							<span>{T("package.replenishGb")}</span>
						</button>

						{false && (
							<button
								className="pc-proxy-package__action-btn"
								onClick={() => {
									router.push(`${getLocalizedPath('/payment-time')}?packageId=${packageData.id}`)
								}}
							>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<g clipPath="url(#clip0_clock)">
									<circle cx="13" cy="11" r="7" fill="white"/>
									<path d="M10 1C7.82441 1 5.69767 1.64514 3.88873 2.85383C2.07979 4.06253 0.669894 5.78049 -0.16267 7.79048C-0.995234 9.80047 -1.21307 12.0122 -0.788633 14.146C-0.364196 16.2798 0.683453 18.2398 2.22183 19.7782C3.76021 21.3166 5.72022 22.3642 7.85401 22.7886C9.9878 23.2131 12.1995 22.9952 14.2095 22.1627C16.2195 21.3301 17.9375 19.9202 19.1462 18.1113C20.3549 16.3023 21 14.1756 21 12C20.9966 9.08367 19.8365 6.28778 17.7744 4.22563C15.7122 2.16347 12.9163 1.00344 10 1ZM13.707 15.707C13.5195 15.8945 13.2652 15.9998 13 15.9998C12.7348 15.9998 12.4805 15.8945 12.293 15.707L9.293 12.707C9.10546 12.5195 9.00006 12.2652 9 12V6C9 5.73478 9.10536 5.48043 9.2929 5.29289C9.48043 5.10536 9.73479 5 10 5C10.2652 5 10.5196 5.10536 10.7071 5.29289C10.8946 5.48043 11 5.73478 11 6V11.586L13.707 14.293C13.8945 14.4805 13.9998 14.7348 13.9998 15C13.9998 15.2652 13.8945 15.5195 13.707 15.707Z" fill="#0067FF"/>
								</g>
								<defs>
									<clipPath id="clip0_clock">
										<rect width="24" height="24" fill="white"/>
									</clipPath>
								</defs>
							</svg>
							<span>{T("package.replenishTime")}</span>
						</button>
						)}

						<button 
							className="pc-proxy-package__action-btn"
							onClick={() => open(<RedeemKeyModal />)}
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<g clipPath="url(#clip0_key)">
									<circle cx="14.5" cy="7.5" r="4.5" fill="white"/>
									<path d="M21.7395 7.56919C21.7395 6.54733 21.5386 5.55705 21.1454 4.62131C20.7636 3.72001 20.2182 2.91056 19.5236 2.21593C18.829 1.5213 18.0195 0.975928 17.1182 0.594168C16.1854 0.198056 15.1922 0 14.1704 0C13.1485 0 12.1582 0.200926 11.2225 0.594168C10.3212 0.975928 9.51174 1.5213 8.81711 2.21593C8.12248 2.91056 7.57711 3.72001 7.19535 4.62131C6.79923 5.55418 6.60118 6.54733 6.60118 7.56919C6.60118 8.8465 6.92266 10.098 7.53405 11.2117L-1.52773 20.2649C-1.73727 20.4744 -1.80329 20.793 -1.67412 21.0944C-1.64829 21.1576 -1.60523 21.215 -1.55643 21.2637L0.472923 23.2931C0.521719 23.3419 0.579127 23.3821 0.642275 23.4108C0.943665 23.54 1.26228 23.4768 1.47181 23.2644L2.72617 22.01L4.53164 23.8155C4.58043 23.8643 4.63784 23.9045 4.70096 23.9332C5.00235 24.0623 5.32099 23.9992 5.5305 23.7868L7.53115 21.7861C7.57995 21.7373 7.62013 21.6799 7.64884 21.6168C7.778 21.3154 7.71486 20.9968 7.50245 20.7873L5.72568 19.0105L10.525 14.2084C11.6358 14.8198 12.8901 15.1412 14.1675 15.1412C15.1893 15.1412 16.1796 14.9403 17.1153 14.5471C18.0166 14.1653 18.8261 13.6199 19.5207 12.9253C20.2153 12.2307 20.7607 11.4213 21.1425 10.5199C21.5386 9.58132 21.7395 8.59104 21.7395 7.56919ZM16.8226 10.2243C16.1136 10.9333 15.1693 11.3236 14.1675 11.3236C13.1658 11.3236 12.2214 10.9333 11.5124 10.2243C10.8034 9.5153 10.4102 8.57095 10.4102 7.56919C10.4102 6.56455 10.8006 5.62307 11.5096 4.91409C12.2185 4.2051 13.1629 3.81473 14.1647 3.81473C15.1664 3.81473 16.1108 4.2051 16.8197 4.91409C17.5287 5.62307 17.9191 6.56742 17.9191 7.56919C17.9248 8.57095 17.5344 9.5153 16.8226 10.2243Z" fill="#0067FF"/>
								</g>
								<defs>
									<clipPath id="clip0_key">
										<rect width="24" height="24" fill="white"/>
									</clipPath>
								</defs>
							</svg>
							<span>{T("package.activateKey")}</span>
						</button>

					</div>
				</div>

				<div className="pc-proxy-package__charts" style={{ display: "flex", gap: "8px", width: "100%", marginTop: "24px", flexDirection: "row", flexWrap: "wrap" }}>
					<TrafficChart packageId={packageData.id} />
					<ProxyGenerator packageId={packageData.id} existingProxies={activeProxies} packageType={packageType} />
				</div>
			</div>
		</main>
	)
}

