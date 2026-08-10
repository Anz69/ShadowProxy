"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import type { UserPackage } from "@/features/packages/types/user-package.types"
import type { User } from "@/features/user/types/user.types"
import { formatTraffic } from "@/shared/utils/format-traffic"
import { formatSeconds } from "@/shared/utils/format-seconds"
import type { Prices, Plan } from "@/features/proxy/types/proxy.types"

type UserPackageCardProps = {
	userPackage: UserPackage
	user: User | null
	prices: Prices | null
	plans?: Plan[]
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

function getPackageTitle(type: string, T: (key: string) => string): string {
	switch (type) {
		case "RESIDENT":
		case "RESIDENT_PREMIUM":
			return T("package.packageTypes.resident")
		case "PREMIUM_RESIDENTIAL":
			return T("package.packageTypes.premiumResidential")
		case "MOBILE":
			return T("package.packageTypes.mobile")
		case "MOBILE_GB":
			return T("package.packageTypes.mobile")
		case "ISP":
			return T("package.packageTypes.isp")
		case "IPV6_GB":
			return T("package.packageTypes.ipv6")
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

function getRatingText(type: string, T: (key: string) => string): string {
	switch (type) {
		case "RESIDENT":
		case "RESIDENT_PREMIUM":
			return T("package.quality")
		case "PREMIUM_RESIDENTIAL":
			return T("package.quality")
		case "MOBILE":
			return T("package.mobileGb")
		case "MOBILE_GB":
			return T("package.mobileGb")
		case "IPV6_GB":
			return T("package.ipv6Rotation")
		default:
			return ""
	}
}

function getPackageStars(type: string): number {
	switch (type) {
		case "RESIDENT":
			return 3
		case "RESIDENT_PREMIUM":
		case "PREMIUM_RESIDENTIAL":
			return 4
		default:
			return 0
	}
}

function formatRemainingTime(
	rentTime: number | null | undefined, 
	createdAt: string | null | undefined, 
	currentTime: Date,
	T: (key: string) => string
): string {
	if (!rentTime || !createdAt) return T("package.notSpecified")
	
	const created = new Date(createdAt)
	const expirationTime = new Date(created.getTime() + rentTime * 1000)
	const diff = expirationTime.getTime() - currentTime.getTime()
	
	if (diff <= 0) return T("package.timeExpired")
	
	const totalSeconds = Math.floor(diff / 1000)
	const days = Math.floor(totalSeconds / 86400)
	const hours = Math.floor((totalSeconds % 86400) / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	
	const parts: string[] = []
	if (days > 0) parts.push(`${days} ${T("package.daysShort")}`)
	if (hours > 0) parts.push(`${hours} ${T("package.hoursShort")}`)
	if (minutes > 0) parts.push(`${minutes} ${T("package.minutesShort")}`)
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ${T("package.secondsShort")}`)
	
	return parts.join(" : ")
}

function getTrafficByPackageType(
	packageType: string, 
	user: User | null, 
	prices: Prices | null, 
	T: (key: string) => string,
	userPackage?: UserPackage,
	currentTime?: Date
): { value: string; label: string } {
	if (!user) return { value: "0 MB", label: T("package.trafficLeft") }
	
	switch (packageType) {
		case "RESIDENT":
			return { value: formatTraffic(user.residentTrafficLeft), label: T("package.trafficLeft") }
		case "RESIDENT_PREMIUM":
			return { value: formatTraffic(user.premiumTrafficLeft), label: T("package.trafficLeft") }
		case "ISP":
			return { value: `${user.ispIpLeft} IP`, label: T("package.trafficLeft") }
		case "MOBILE": {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const pkg = userPackage as any
			if (pkg && pkg.planId && pkg.rentTime && currentTime) {
				const remainingTime = formatRemainingTime(pkg.rentTime, pkg.createdAt, currentTime, T)
				if (remainingTime === T("package.timeExpired")) {
					return { value: "", label: T("package.timeLeftLabel") }
				}
				return { value: remainingTime, label: T("package.timeLeftLabel") }
			}
			return { value: formatTraffic(user.mobileTrafficLeft || "0"), label: T("package.trafficLeft") }
		}
		case "MOBILE_GB":
			return { value: formatTraffic(user.mobileGbTrafficLeft), label: T("package.trafficLeft") }
		case "IPV6_GB":
			return { value: formatTraffic(user.ipv6GbTrafficLeft), label: T("package.trafficLeft") }
		case "PREMIUM_RESIDENTIAL":
			return { value: formatTraffic(user.premiumResidentialTrafficLeft || "0"), label: T("package.trafficLeft") }
		case "ISP_USA":
			return { value: formatTraffic(user.ispUsaTrafficLeft || "0"), label: T("package.trafficLeft") }
		case "ISP_EU":
			return { value: formatTraffic(user.ispEuTrafficLeft || "0"), label: T("package.trafficLeft") }
		case "RESIDENTIAL_LITE":
			return { value: formatTraffic(user.residentialLiteTrafficLeft || "0"), label: T("package.trafficLeft") }
		default:
			return { value: "0 MB", label: T("package.trafficLeft") }
	}
}

function hasTraffic(
	packageType: string, 
	user: User | null, 
	userPackage?: UserPackage,
	currentTime?: Date
): boolean {
	if (!user) return false
	
	let traffic: string | number = "0"
	
	if (packageType === "RESIDENT") {
		traffic = user.residentTrafficLeft
	} else if (packageType === "RESIDENT_PREMIUM") {
		traffic = user.premiumTrafficLeft
	} else if (packageType === "PREMIUM_RESIDENTIAL") {
		traffic = user.premiumResidentialTrafficLeft || "0"
	} else if (packageType === "ISP") {
		traffic = user.ispIpLeft
		return typeof traffic === "number" && traffic > 0
	} else if (packageType === "MOBILE_GB") {
		traffic = user.mobileGbTrafficLeft
	} else if (packageType === "IPV6_GB") {
		traffic = user.ipv6GbTrafficLeft
	} else if (packageType === "ISP_USA") {
		traffic = user.ispUsaTrafficLeft || "0"
	} else if (packageType === "ISP_EU") {
		traffic = user.ispEuTrafficLeft || "0"
	} else if (packageType === "RESIDENTIAL_LITE") {
		traffic = user.residentialLiteTrafficLeft || "0"
	} else if (packageType === "MOBILE") {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const pkg = userPackage as any
		if (pkg && pkg.rentTime && pkg.createdAt && currentTime) {
			const created = new Date(pkg.createdAt)
			const expirationTime = new Date(created.getTime() + pkg.rentTime * 1000)
			const diff = expirationTime.getTime() - currentTime.getTime()
			return diff > 0
		}
		traffic = user.mobileTrafficLeft || "0"
	}
	
	const trafficBigInt = BigInt(String(traffic))
	return trafficBigInt > BigInt(0)
}

export default function UserPackageCard({ userPackage, user, prices, plans = [] }: UserPackageCardProps) {
	const router = useRouter()
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const [isLoading, setIsLoading] = useState(false)
	
	// Состояние для текущего времени (для таймера)
	const [currentTime, setCurrentTime] = useState(new Date())
	
	// Обновляем текущее время каждую секунду для MOBILE пакетов
	useEffect(() => {
		if (userPackage.type !== "MOBILE") return
		
		const interval = setInterval(() => {
			setCurrentTime(new Date())
		}, 1000)
		
		return () => clearInterval(interval)
	}, [userPackage.type])

	const getLocalizedPath = (path: string) => {
		return addLocaleToPath(path, currentLocale)
	}

	const handleManageClick = () => {
		setIsLoading(true)
		// Используем id из UserPackage (это id UserPackage, а не Package)
		router.push(getLocalizedPath(`/packages/${userPackage.id}`))
	}

	// Используем type из UserPackage (тариф), а не из package
	const packageType = userPackage.type
	const T = (key: string) => t(key, currentLocale as "ru" | "en" | "zh-CN")
	const title = getPackageTitle(packageType, T)
	const ratingText = getRatingText(packageType, T)
	const stars = getPackageStars(packageType)
	const showStars = stars > 0

	const trafficInfo = getTrafficByPackageType(packageType, user, prices, T, userPackage, currentTime)

	// Вычисляем оставшееся время аренды для MOBILE пакетов
	const remainingTime = useMemo(() => {
		if (packageType !== "MOBILE") return null
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const pkg = userPackage as any
		if (!pkg.rentTime || !pkg.createdAt) return null
		
		const createdAt = new Date(pkg.createdAt)
		const expirationTime = new Date(createdAt.getTime() + pkg.rentTime * 1000)
		const diff = expirationTime.getTime() - currentTime.getTime()
		
		if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
		
		const totalSeconds = Math.floor(diff / 1000)
		const days = Math.floor(totalSeconds / 86400)
		const hours = Math.floor((totalSeconds % 86400) / 3600)
		const minutes = Math.floor((totalSeconds % 3600) / 60)
		const seconds = totalSeconds % 60
		
		return { days, hours, minutes, seconds, expired: false }
	}, [userPackage, currentTime, packageType])

	// Находим план для MOBILE пакетов
	const plan = packageType === "MOBILE" && userPackage.planId 
		? plans.find(p => p.id === userPackage.planId)
		: null

	return (
		<div className="flex h-full flex-col gap-4 rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-6 shadow-[0_30px_70px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] light:border-[#e6e8ef] light:bg-none light:bg-white light:shadow-[0_24px_60px_-44px_rgba(14,16,25,0.14)]">
			{showStars && (
				<div className="flex items-center justify-between gap-2">
					<span className="inline-flex items-center rounded-full border border-[#6aa5ff]/30 bg-[#6aa5ff]/[0.12] px-3 py-1 text-[12px] font-medium text-[#6aa5ff] light:border-[#2f6bff]/25 light:bg-[#2f6bff]/[0.08] light:text-[#2f6bff]">{ratingText}</span>
					<div className="flex items-center text-[#6aa5ff]">
						<svg width="80" height="16" viewBox="0 0 80 16" fill="none" xmlns="http://www.w3.org/2000/svg">
							{renderStars(stars)}
						</svg>
					</div>
				</div>
			)}
			{!showStars && ratingText && (
				<div>
					<span className="inline-flex items-center rounded-full border border-[#6aa5ff]/30 bg-[#6aa5ff]/[0.12] px-3 py-1 text-[12px] font-medium text-[#6aa5ff] light:border-[#2f6bff]/25 light:bg-[#2f6bff]/[0.08] light:text-[#2f6bff]">{ratingText}</span>
				</div>
			)}
			<div>
				<h3 className="font-[TalosDisplay] text-[20px] font-semibold text-white light:text-[#0e1019]">{title}</h3>
			</div>
			<hr className="border-0 border-t border-white/[0.08] light:border-[#e6e8ef]" />
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<span className="text-[13px] text-white/45 light:text-[#8a93a3]">{T("package.type")}</span>
					<span className="text-[14px] font-medium text-white/80 light:text-[#475467]">{title}</span>
				</div>
				{plan && (
					<>
						<div className="flex items-center justify-between gap-3">
							<span className="text-[13px] text-white/45 light:text-[#8a93a3]">{T("payment.country")}</span>
							<span className="text-[14px] font-medium text-white/80 light:text-[#475467]">{plan.countryCode.toUpperCase()}</span>
						</div>
						<div className="flex items-center justify-between gap-3">
							<span className="text-[13px] text-white/45 light:text-[#8a93a3]">{T("payment.operator")}</span>
							<span className="text-[14px] font-medium text-white/80 light:text-[#475467]">{plan.name}</span>
						</div>
					</>
				)}
				<div className="flex items-center justify-between gap-3">
					<span className="text-[13px] text-white/45 light:text-[#8a93a3]">{T("package.status")}</span>
					{packageType === "MOBILE" && remainingTime ? (
						remainingTime.expired ? (
							<span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#FFD964] px-2.5 py-1 text-[12px] font-medium leading-tight tracking-[-0.01em] text-[#222222]">
								<AlertCircle size={16} style={{ opacity: 0.5 }} />
								{T("package.timeExpired")}
							</span>
						) : (
							<span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#6aa5ff] light:text-[#16a34a]">
								<span className="h-1.5 w-1.5 rounded-full bg-[#6aa5ff] shadow-[0_0_8px_rgba(106,165,255,0.9)] light:bg-[#16a34a] light:shadow-none" />
								{T("package.active")}
							</span>
						)
					) : (
						<span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#6aa5ff]">
							<span className="h-1.5 w-1.5 rounded-full bg-[#6aa5ff] shadow-[0_0_8px_rgba(106,165,255,0.9)]" />
							{T("package.active")}
						</span>
					)}
				</div>
				{/* Для MOBILE пакетов скрываем колонку "Время" и бейдж "Пакет закончился", если время истекло */}
				{!(packageType === "MOBILE" && remainingTime && remainingTime.expired) && (
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="text-[13px] text-white/45">{trafficInfo.label}</span>
						<span className="text-[14px] font-medium text-white/80 light:text-[#475467]">{trafficInfo.value}</span>
						{!hasTraffic(packageType, user, userPackage, currentTime) && packageType !== "MOBILE" && (
							<span className="inline-flex w-full items-center gap-1.5 rounded-lg bg-[#FFD964]/15 px-2.5 py-1 text-[12px] font-medium text-[#FFD964] light:bg-[#f59e0b]/[0.14] light:text-[#d97706]">
								<AlertCircle size={16} style={{ opacity: 0.6 }} />
								{T("package.finished")}
							</span>
						)}
					</div>
				)}
			</div>
			<button
				className="relative mt-auto inline-flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
				onClick={handleManageClick}
				disabled={isLoading}
			>
				{isLoading && <div className="absolute inset-0 animate-pulse bg-white/10" />}
				<span className="relative z-[1]">
					{isLoading ? T("common.loading") : T("package.manage")}
				</span>
			</button>
		</div>
	)
}

