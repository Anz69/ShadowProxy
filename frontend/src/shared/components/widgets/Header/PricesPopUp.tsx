import type { FC } from "react"
import Image from "next/image"

import type { Prices } from "@/features/proxy/types/proxy.types"
import { isProxyTypeDisabled } from "@/shared/constants/sprint-gating"

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
	type: CatalogItemType | "PREMIUM_MOBILE_SOON"
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
		type: "MOBILE",
		icon: "/tariff-mobile-gb.svg",
		titleKey: "payment.tariffTypes.mobile",
		taglineKey: "payment.descriptions.mobile",
		getPrice: p => (typeof p.mobile === "number" ? p.mobile : 0),
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
		type: "PREMIUM_MOBILE_SOON",
		icon: "/tariff-mobile-gb.svg",
		titleKey: "main.proxyTypes.premiumMobile.title",
		taglineKey: "main.proxyTypes.premiumMobile.description",
		tier: "premium",
		soon: true
	}
]

const stripHtml = (s: string): string =>
	s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")

const ArrowIcon = () => (
	<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
		<path d="M3 7H11M11 7L7 3M11 7L7 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const MegaItem: FC<{
	item: Item
	prices: Prices
	T: (key: string) => string
	onClick: () => void
}> = ({ item, prices, T, onClick }) => {
	const price = item.getPrice ? item.getPrice(prices) : null

	return (
		<button
			type="button"
			onClick={(e) => {
				// Не даём клику всплыть к триггеру каталога (span onClick тогда
				// снова переключал бы дропдаун открытым после выбора).
				e.stopPropagation()
				onClick()
			}}
			className={`group flex w-full items-center gap-3.5 rounded-[14px] border border-transparent px-3.5 py-3 text-left transition-all duration-200 hover:border-[#6aa5ff]/30 hover:bg-white/[0.04] ${item.soon ? "cursor-default opacity-90" : "cursor-pointer"}`}
			disabled={item.soon}
		>
			<span className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] border border-white/[0.12] bg-white/[0.05]">
				<Image
					src={item.icon}
					alt=""
					width={20}
					height={20}
					className="[filter:brightness(0)_saturate(100%)_invert(66%)_sepia(58%)_saturate(900%)_hue-rotate(187deg)_brightness(101%)]"
				/>
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="font-[TalosDisplay] text-[15px] font-semibold text-white">{T(item.titleKey)}</span>
				<span className="font-[TalosInter] text-[12.5px] text-white/45 line-clamp-1">{stripHtml(T(item.taglineKey))}</span>
			</span>
			{item.soon ? (
				<span className="inline-flex shrink-0 items-center gap-2 font-[TalosInter] text-[13px] text-white/40 whitespace-nowrap">
					<span className="h-[7px] w-[7px] rounded-full bg-[#ffd964] shadow-[0_0_8px_#ffd964]" aria-hidden="true" />
					{T("main.proxyTypes.comingSoon")}
				</span>
			) : price !== null ? (
				<span className="shrink-0 font-[TalosInter] text-[14px] font-semibold text-white whitespace-nowrap">{T("package.from")} {price}$ {T("package.perGb")}</span>
			) : (
				<span />
			)}
			<span className="shrink-0 text-white/30 transition-colors duration-200 group-hover:text-[#6aa5ff]" aria-hidden="true"><ArrowIcon /></span>
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
			className={`mega-menu ${isBurger ? "mega-menu--burger" : "mega-menu--dropdown"} flex flex-col gap-2 rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-3 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl`}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			role="menu"
		>
			<div className="flex flex-col">
				<div className="flex items-center px-3 py-2">
					<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">{T("main.proxyTypes.standardTitle")}</span>
				</div>
				{STANDARD.filter(item => !isProxyTypeDisabled(item.type)).map(item => (
					<MegaItem key={item.type} item={item} prices={prices} T={T} onClick={() => handle(item)} />
				))}
			</div>

			<div className="relative flex flex-col overflow-hidden rounded-[16px] border border-[#6aa5ff]/25 bg-[radial-gradient(120%_130%_at_100%_0%,rgba(59,130,246,0.14),transparent_55%)] p-1">
				{/* синий акцент, растворяющийся из левого нижнего угла */}
				<span aria-hidden className="pointer-events-none absolute -bottom-20 -left-20 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(47,107,255,0.5),transparent_70%)] blur-[55px]" />
				<div className="relative z-[1] flex items-center justify-between px-3 py-2">
					<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">{T("main.proxyTypes.premiumTitle")}</span>
					<span className="rounded-full bg-gradient-to-b from-[#6aa5ff] to-[#2f6bff] px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-white">PREMIUM</span>
				</div>
				<div className="relative z-[1] flex flex-col">
					{PREMIUM.filter(item => !isProxyTypeDisabled(item.type)).map(item => (
						<MegaItem key={item.type} item={item} prices={prices} T={T} onClick={() => handle(item)} />
					))}
				</div>
			</div>
		</div>
	)
}

export default PricesPopUp
