import type { FC } from "react"
import Image from "next/image"

import type { Prices } from "@/features/proxy/types/proxy.types"
import { isProxyTypeDisabled } from "@/shared/constants/sprint-gating"
import { formatPrice } from "@/shared/utils/format-price"

export type CatalogItemType = "RESIDENT_PREMIUM" | "MOBILE" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL" | "ISP_USA" | "ISP_EU" | "RESIDENTIAL_LITE"

export interface PricesPopUpProps {
	prices: Prices
	T: (key: string) => string
	variant?: "dropdown" | "burger"
	onMouseEnter?: () => void
	onMouseLeave?: () => void
	onItemSelect?: (type: CatalogItemType) => void
}

type Item = {
	type: CatalogItemType
	icon: string
	titleKey: string
	taglineKey: string
	getPrice?: (p: Prices) => number
	tier: "standard" | "premium"
	soon?: boolean
}

const STANDARD: Item[] = [
	{
		type: "RESIDENT_PREMIUM",
		icon: "/tariff-resident.svg",
		titleKey: "payment.tariffTypes.resident",
		taglineKey: "payment.descriptions.resident",
		getPrice: p => p.resident_premium ?? 0,
		tier: "standard"
	},
	{
		type: "ISP_USA",
		icon: "/tariff-resident.svg",
		titleKey: "payment.tariffTypes.ispUsa",
		taglineKey: "payment.descriptions.ispUsa",
		getPrice: p => p.isp_usa ?? 0,
		tier: "standard"
	},
	{
		type: "ISP_EU",
		icon: "/tariff-resident.svg",
		titleKey: "payment.tariffTypes.ispEu",
		taglineKey: "payment.descriptions.ispEu",
		getPrice: p => p.isp_eu ?? 0,
		tier: "standard"
	},
	{
		type: "RESIDENTIAL_LITE",
		icon: "/tariff-resident.svg",
		titleKey: "payment.tariffTypes.residentialLite",
		taglineKey: "payment.descriptions.residentialLite",
		getPrice: p => p.residential_lite ?? 0,
		tier: "standard"
	}
]

const PREMIUM: Item[] = [
	{
		type: "PREMIUM_RESIDENTIAL",
		icon: "/tariff-premium.svg",
		titleKey: "payment.tariffTypes.premiumResidential",
		taglineKey: "payment.descriptions.premiumResidential",
		getPrice: p => p.premium_residential ?? 0,
		tier: "premium"
	},
	{
		type: "MOBILE",
		icon: "/tariff-mobile-gb.svg",
		titleKey: "main.proxyTypes.premiumMobile.title",
		taglineKey: "main.proxyTypes.premiumMobile.description",
		getPrice: p => (typeof p.mobile === "number" ? p.mobile : 0),
		tier: "premium"
	}
]

const stripHtml = (s: string): string =>
	s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")

const ArrowIcon = () => (
	<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
		<path d="M3 7H11M11 7L7 3M11 7L7 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const PRICE_KEY_BY_TYPE: Partial<Record<CatalogItemType, keyof NonNullable<Prices["minimum_prices"]>>> = {
	RESIDENT_PREMIUM: "resident_premium",
	PREMIUM_RESIDENTIAL: "premium_residential",
	MOBILE: "mobile",
	MOBILE_GB: "mobile_gb",
	IPV6_GB: "ipv6_gb",
	ISP_USA: "isp_usa",
	ISP_EU: "isp_eu",
	RESIDENTIAL_LITE: "residential_lite"
}

const MegaItem: FC<{
	item: Item
	prices: Prices
	T: (key: string) => string
	onClick: () => void
}> = ({ item, prices, T, onClick }) => {
	const basePrice = item.getPrice ? item.getPrice(prices) : null
	const priceKey = PRICE_KEY_BY_TYPE[item.type]
	const minimumPrice = priceKey ? prices.minimum_prices?.[priceKey] : undefined
	const price = basePrice === null ? null : minimumPrice && minimumPrice > 0 ? Math.min(basePrice || minimumPrice, minimumPrice) : basePrice

	return (
		<button
			type="button"
			onClick={(e) => {
				// Не даём клику всплыть к триггеру каталога (span onClick тогда
				// снова переключал бы дропдаун открытым после выбора).
				e.stopPropagation()
				onClick()
			}}
			className={`group grid min-h-[68px] w-full grid-cols-[40px_minmax(0,1fr)_auto_16px] items-center gap-x-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors duration-200 hover:border-[#6aa5ff]/25 hover:bg-white/[0.045] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#79a8ff] ${item.soon ? "cursor-default opacity-90" : "cursor-pointer"}`}
			disabled={item.soon}
		>
			<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.045]">
				<Image
					src={item.icon}
					alt=""
					width={20}
					height={20}
					className="[filter:brightness(0)_saturate(100%)_invert(66%)_sepia(58%)_saturate(900%)_hue-rotate(187deg)_brightness(101%)]"
				/>
			</span>
			<span className="flex min-w-0 flex-col gap-1">
				<span className="font-[TalosDisplay] text-sm font-semibold leading-5 text-white">{T(item.titleKey)}</span>
				<span className="line-clamp-2 font-[TalosInter] text-xs leading-[1.45] text-white/55">{stripHtml(T(item.taglineKey))}</span>
			</span>
			{item.soon ? (
				<span className="inline-flex shrink-0 items-center gap-2 font-[TalosInter] text-xs text-white/50 whitespace-nowrap">
					<span className="h-[7px] w-[7px] rounded-full bg-[#ffd964] shadow-[0_0_8px_#ffd964]" aria-hidden="true" />
					{T("main.proxyTypes.comingSoon")}
				</span>
			) : price !== null ? (
				<span className="inline-flex min-w-[112px] shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-2 font-[TalosInter] text-[13px] font-semibold tabular-nums text-white/90 whitespace-nowrap">
					{T("package.from")} {formatPrice(price)}$ {T("package.perGb")}
				</span>
			) : (
				<span />
			)}
			<span className="shrink-0 text-white/35 transition-colors duration-200 group-hover:text-[#6aa5ff]" aria-hidden="true"><ArrowIcon /></span>
		</button>
	)
}

const PricesPopUp: FC<PricesPopUpProps> = ({
	prices,
	T,
	variant = "dropdown",
	onMouseEnter = () => {},
	onMouseLeave = () => {},
	onItemSelect
}) => {
	const isBurger = variant === "burger"

	const handle = (item: Item) => {
		if (item.soon) return
		onItemSelect?.(item.type as CatalogItemType)
	}

	return (
		<div
			className={`mega-menu ${isBurger ? "mega-menu--burger" : "mega-menu--dropdown"} flex flex-col gap-2`}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			role="group"
			aria-label={T("header.nav.catalog")}
		>
			<div className="flex flex-col">
				<div className="flex items-center px-3 py-2">
					<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">{T("main.proxyTypes.standardTitle")}</span>
				</div>
				{STANDARD.filter(item => !isProxyTypeDisabled(item.type)).map(item => (
					<MegaItem key={item.type} item={item} prices={prices} T={T} onClick={() => handle(item)} />
				))}
			</div>

			<div className="relative flex flex-col overflow-hidden rounded-[14px] border border-[#6aa5ff]/20 bg-[#172133] p-1">
				<div className="flex items-center justify-between px-3 py-2">
					<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">{T("main.proxyTypes.premiumTitle")}</span>
					<span className="rounded-full border border-[#6aa5ff]/25 bg-[#2f6bff]/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-[#9cc2ff]">PREMIUM</span>
				</div>
				<div className="flex flex-col">
					{PREMIUM.filter(item => !isProxyTypeDisabled(item.type)).map(item => (
						<MegaItem key={item.type} item={item} prices={prices} T={T} onClick={() => handle(item)} />
					))}
				</div>
			</div>
		</div>
	)
}

export default PricesPopUp
