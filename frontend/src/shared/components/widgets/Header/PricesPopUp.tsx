import type { FC } from "react"
import Image from "next/image"

import type { Prices } from "@/features/proxy/types/proxy.types"

export type CatalogItemType = "RESIDENT_PREMIUM" | "MOBILE" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL"

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
	const isPremium = item.tier === "premium"
	const cls = [
		"mega-item",
		isPremium && "mega-item--premium",
		item.soon && "mega-item--soon"
	].filter(Boolean).join(" ")

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
			className={cls}
			disabled={item.soon}
		>
			<span className="mega-item__icon">
				<Image src={item.icon} alt="" width={20} height={20} />
			</span>
			<span className="mega-item__body">
				<span className="mega-item__title">{T(item.titleKey)}</span>
				<span className="mega-item__tagline">{stripHtml(T(item.taglineKey))}</span>
			</span>
			{item.soon ? (
				<span className="mega-item__soon-tag">{T("main.proxyTypes.comingSoon")}</span>
			) : price !== null ? (
				<span className="mega-item__price">{T("package.from")} {price}$ / {T("package.perGb")}</span>
			) : (
				<span />
			)}
			<span className="mega-item__arrow" aria-hidden="true"><ArrowIcon /></span>
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
			className={`mega-menu ${isBurger ? "mega-menu--burger" : "mega-menu--dropdown"}`}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			role="menu"
		>
			<div className="mega-menu__col">
				<div className="mega-menu__col-head">
					<span className="mega-menu__col-label">{T("main.proxyTypes.standardTitle")}</span>
				</div>
				{STANDARD.map(item => (
					<MegaItem key={item.type} item={item} prices={prices} T={T} onClick={() => handle(item)} />
				))}
			</div>

			<div className="mega-menu__divider" aria-hidden="true" />

			<div className="mega-menu__col mega-menu__col--premium">
				<div className="mega-menu__col-head">
					<span className="mega-menu__col-label">{T("main.proxyTypes.premiumTitle")}</span>
					<span className="mega-menu__col-badge">PREMIUM</span>
				</div>
				{PREMIUM.map(item => (
					<MegaItem key={item.type} item={item} prices={prices} T={T} onClick={() => handle(item)} />
				))}
			</div>
		</div>
	)
}

export default PricesPopUp
