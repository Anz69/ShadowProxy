import type { FC } from "react"

import type { Package as PackageType } from "@/features/packages/types/packages.types"
import type { User } from "@/features/user/types/user.types"

import { formatTraffic } from "@/shared/utils/format-traffic"

type PackageProps = {
	item: PackageType
	isActive: boolean
	onClick: () => void
	originalPrice: number
	user?: User | null
}

const Package: FC<PackageProps> = ({
	item,
	isActive,
	onClick,
	originalPrice,
	user
}) => {
	if (!item) return null

	const value = Number(BigInt(item.traffic) / BigInt(1024 ** 3))
	// Защита от деления на ноль (например legacy MOBILE-пакеты с traffic="0")
	if (value <= 0) return null
	const pricePerGb = Number(item.price) / value
	const discount = originalPrice > 0 ? ((originalPrice - pricePerGb) / originalPrice) * 100 : 0
	const itemOriginalPrice = value * originalPrice

	// Функция форматирования трафика
	const formatTrafficLeft = (bytesStr: string): { value: string; unit: string } => {
		const bytes = BigInt(bytesStr || "0")
		if (bytes === BigInt(0)) return { value: "0", unit: "мб" }
		
		const gb = Number(bytes) / (1024 ** 3)
		
		// Если меньше 1 ГБ, показываем в МБ
		if (gb < 1) {
			const mb = Number(bytes) / (1024 ** 2)
			const formatted = parseFloat(mb.toFixed(2)).toString()
			return { value: formatted, unit: "мб" }
		}
		
		// Форматируем до 2 знаков после запятой и удаляем лишние нули
		const formatted = parseFloat(gb.toFixed(2)).toString()
		return { value: formatted, unit: "Гб" }
	}

	// Получаем остаток трафика для типа пакета
	const getTrafficLeft = (): { value: string; unit: string } | null => {
		if (!user) return null
		
		switch (item.type) {
			case "RESIDENT":
				return formatTrafficLeft(user.residentTrafficLeft)
			case "RESIDENT_PREMIUM":
				return formatTrafficLeft(user.premiumTrafficLeft)
			case "MOBILE_GB":
				return formatTrafficLeft(user.mobileGbTrafficLeft)
			case "IPV6_GB":
				return formatTrafficLeft(user.ipv6GbTrafficLeft)
			default:
				return null
		}
	}

	const trafficLeft = getTrafficLeft()

	return (
		<div
			onClick={onClick}
			className={`bg-white/10 flex w-full min-w-[280px] md:min-w-0 flex-shrink-0 cursor-pointer flex-row items-start gap-2 rounded-xl p-4 duration-200 relative ${isActive ? "opacity-100 ring-2 ring-inset ring-[#0067FF]" : "opacity-50 hover:opacity-100"}`}
		>
			<div className="flex flex-col gap-2 flex-grow">
				<span className="text-white text-[20px] font-semibold">
					{formatTraffic(item.traffic)}
				</span>
				{trafficLeft && (
					<span className="text-white/70 text-[14px]">
						Остаток: {trafficLeft.value} {trafficLeft.unit}
					</span>
				)}
				<span className="flex flex-row items-baseline gap-2">
					<span className="text-white text-[16px] font-semibold">
						{item.price}$
					</span>
					<span className="text-white/30 text-[16px] font-semibold relative inline-block">
						<span className="line-through relative" style={{ top: "-3px", display: "inline-block" }}>{itemOriginalPrice.toFixed(2)}$</span>
					</span>
				</span>
			</div>
			<span 
				className="text-white rounded-lg px-2 py-1 text-base leading-4 font-semibold bg-cover bg-center relative overflow-hidden whitespace-nowrap mt-auto"
				style={{
					backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.15)), url('/left-section-background.jpg')"
				}}
			>
				<span className="relative z-10">-{discount.toFixed(0)}%</span>
			</span>
		</div>
	)
}

export default Package
