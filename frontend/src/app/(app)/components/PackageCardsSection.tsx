"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import type { SupportedLocale } from "@/shared/utils/i18n"
import { addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { formatPrice } from "@/shared/utils/format-price"
import type { User } from "@/features/user/types/user.types"
import type { Prices } from "@/features/proxy/types/proxy.types"
import type { Package } from "@/features/packages/types/packages.types"

type PackageType = "RESIDENT" | "RESIDENT_PREMIUM" | "MOBILE" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL"
type CardType = PackageType | "PREMIUM_MOBILE_PLACEHOLDER"

type CardData = {
	type: CardType
	icon: string
	title: string
	description: string
	features: string[]
	tier: "standard" | "premium"
	comingSoon?: boolean
}

const stripHtml = (s: string): string => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")

const buildCards = (T: (key: string) => string): CardData[] => [
	{
		type: "RESIDENT_PREMIUM",
		icon: "/tariff-resident.svg",
		title: T("main.proxyTypes.resident.title"),
		description: stripHtml(T("main.proxyTypes.resident.description")),
		features: [
			T("main.proxyTypes.resident.features.blocks"),
			T("main.proxyTypes.resident.features.speed"),
			T("main.proxyTypes.resident.features.connection")
		],
		tier: "standard"
	},
	{
		type: "MOBILE",
		icon: "/tariff-mobile-gb.svg",
		title: T("main.proxyTypes.mobile.title"),
		description: stripHtml(T("main.proxyTypes.mobile.description")),
		features: [
			T("main.proxyTypes.mobile.features.real"),
			T("main.proxyTypes.mobile.features.speed"),
			T("main.proxyTypes.mobile.features.geo")
		],
		tier: "standard"
	},
	{
		type: "PREMIUM_RESIDENTIAL",
		icon: "/tariff-premium.svg",
		title: T("main.proxyTypes.premiumResidential.title"),
		description: stripHtml(T("main.proxyTypes.premiumResidential.description")),
		features: [
			T("main.proxyTypes.premiumResidential.features.geo"),
			T("main.proxyTypes.premiumResidential.features.countries"),
			T("main.proxyTypes.premiumResidential.features.rotation")
		],
		tier: "premium"
	},
	{
		type: "PREMIUM_MOBILE_PLACEHOLDER",
		icon: "/tariff-mobile-gb.svg",
		title: T("main.proxyTypes.premiumMobile.title"),
		description: stripHtml(T("main.proxyTypes.premiumMobile.description")),
		features: [
			T("main.proxyTypes.premiumMobile.features.geo"),
			T("main.proxyTypes.premiumMobile.features.rotation"),
			T("main.proxyTypes.premiumMobile.features.uptime")
		],
		tier: "premium",
		comingSoon: true
	}
]

type Props = {
	user: User | null
	prices: Prices
	packages?: Package[]
	locale: SupportedLocale
}

function cheapestPricePerGb(
	type: "RESIDENT_PREMIUM" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL" | "MOBILE",
	prices: Prices,
	packages?: Package[]
): number {
	let p = 0
	if (type === "RESIDENT_PREMIUM") p = prices.resident_premium
	else if (type === "MOBILE_GB") p = prices.mobile_gb
	else if (type === "IPV6_GB") p = prices.ipv6_gb
	else if (type === "PREMIUM_RESIDENTIAL") p = prices.premium_residential
	else if (type === "MOBILE") p = typeof prices.mobile === "number" ? prices.mobile : 0

	let cheap = p
	if (packages && packages.length > 0) {
		for (const pkg of packages.filter(x => x.type === type)) {
			const gb = Number(BigInt(pkg.traffic)) / (1024 ** 3)
			// Пакеты теперь = объёмы-пресеты без цены (price: 0). Цена берётся
			// из тарификации, поэтому учитываем только пакеты с реальной ценой.
			if (gb > 0 && pkg.price > 0) {
				const per = pkg.price / gb
				if (per < cheap) cheap = per
			}
		}
	}
	return Math.min(p, cheap)
}

const CheckIcon = () => (
	<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
		<path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

export default function PackageCardsSection({ user, prices, packages, locale }: Props) {
	const router = useRouter()
	const T = (key: string) => t(key, locale)
	const cards = buildCards(T)

	const priceText = (type: CardType): string | null => {
		if (type === "PREMIUM_MOBILE_PLACEHOLDER") return null
		if (type === "RESIDENT_PREMIUM" || type === "MOBILE_GB" || type === "IPV6_GB" || type === "PREMIUM_RESIDENTIAL" || type === "MOBILE") {
			const p = cheapestPricePerGb(type, prices, packages)
			if (p > 0) return `${T("payment.from")} ${formatPrice(p)}$ / ${T("payment.units.gb")}`
		}
		return null
	}

	const getLocalizedPath = (path: string) => addLocaleToPath(path, locale)

	const onClick = (type: CardType) => {
		if (type === "PREMIUM_MOBILE_PLACEHOLDER") return
		if (!user) { router.push(getLocalizedPath("/auth/login")); return }
		let tariff = "RESIDENT_PREMIUM"
		if (type === "IPV6_GB") tariff = "IPV6"
		else if (type === "MOBILE_GB") tariff = "MOBILE_GB"
		else if (type === "PREMIUM_RESIDENTIAL") tariff = "PREMIUM_RESIDENTIAL"
		else if (type === "MOBILE") tariff = "MOBILE"
		router.push(`${getLocalizedPath("/payment")}?tariff=${tariff}`)
	}

	const renderCard = (card: CardData) => {
		const price = priceText(card.type)
		const isPremium = card.tier === "premium"
		const isSoon = !!card.comingSoon
		const cls = [
			"proxy-tier-card",
			isPremium && "proxy-tier-card--premium",
			isSoon && "proxy-tier-card--coming-soon"
		].filter(Boolean).join(" ")

		return (
			<article key={card.type} className={cls}>
				{isPremium && <span className="proxy-tier-card__badge">PREMIUM</span>}

				<div className="proxy-tier-card__head">
					<span className="proxy-tier-card__icon">
						<Image src={card.icon} alt="" width={28} height={28} />
					</span>
					<h3 className="proxy-tier-card__title">{card.title}</h3>
				</div>

				<p className="proxy-tier-card__desc">{card.description}</p>

				<ul className="proxy-tier-card__features">
					{card.features.map((f, i) => (
						<li key={i} className="proxy-tier-card__feature">
							<span className="proxy-tier-card__check"><CheckIcon /></span>
							<span>{f}</span>
						</li>
					))}
				</ul>

				<div className="proxy-tier-card__foot">
					<div className="proxy-tier-card__price">{price ?? T("main.proxyTypes.comingSoon")}</div>
					{isSoon ? (
						<span className="proxy-tier-card__cta proxy-tier-card__cta--soon" aria-disabled="true">
							<span className="proxy-tier-card__cta-dot" />
							{T("main.proxyTypes.comingSoon")}
						</span>
					) : (
						<button
							type="button"
							className="proxy-tier-card__cta"
							onClick={() => onClick(card.type)}
						>
							{T("main.proxyTypes.more")}
						</button>
					)}
				</div>
			</article>
		)
	}

	const standard = cards.filter(c => c.tier === "standard")
	const premium = cards.filter(c => c.tier === "premium")

	return (
		<section className="section section-proxy proxy-tier-section">

			<div className="proxy-tier-group">
				<div className="proxy-tier-group__head">
					<h3 className="proxy-tier-group__title">{T("main.proxyTypes.standardTitle")}</h3>
					<p className="proxy-tier-group__sub">{T("main.proxyTypes.standardSubtitle")}</p>
				</div>
				<div className="proxy-tier-group__grid">
					{standard.map(renderCard)}
				</div>
			</div>

			{premium.length > 0 && (
				<div className="proxy-tier-group">
					<div className="proxy-tier-group__head">
						<h3 className="proxy-tier-group__title">{T("main.proxyTypes.premiumTitle")}</h3>
						<p className="proxy-tier-group__sub">{T("main.proxyTypes.premiumSubtitle")}</p>
					</div>
					<div className="proxy-tier-group__grid">
						{premium.map(renderCard)}
					</div>
				</div>
			)}
		</section>
	)
}
