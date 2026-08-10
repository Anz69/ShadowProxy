"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import type { SupportedLocale } from "@/shared/utils/i18n"
import { addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { formatPrice } from "@/shared/utils/format-price"
import SectionEyebrow from "@/shared/components/ui/SectionEyebrow"
import type { User } from "@/features/user/types/user.types"
import type { Prices } from "@/features/proxy/types/proxy.types"
import type { Package } from "@/features/packages/types/packages.types"
import { isProxyTypeDisabled } from "@/shared/constants/sprint-gating"

type PackageType = "RESIDENT" | "RESIDENT_PREMIUM" | "MOBILE" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL" | "ISP_USA" | "ISP_EU" | "RESIDENTIAL_LITE"
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
		type: "RESIDENTIAL_LITE",
		icon: "/tariff-resident.svg",
		title: T("main.proxyTypes.residentialLite.title"),
		description: stripHtml(T("main.proxyTypes.residentialLite.description")),
		features: [
			T("main.proxyTypes.residentialLite.features.price"),
			T("main.proxyTypes.residentialLite.features.geo"),
			T("main.proxyTypes.residentialLite.features.rotation")
		],
		tier: "standard"
	},
	{
		type: "ISP_USA",
		icon: "/tariff-resident.svg",
		title: T("main.proxyTypes.ispUsa.title"),
		description: stripHtml(T("main.proxyTypes.ispUsa.description")),
		features: [
			T("main.proxyTypes.ispUsa.features.speed"),
			T("main.proxyTypes.ispUsa.features.stable"),
			T("main.proxyTypes.ispUsa.features.rotation")
		],
		tier: "standard"
	},
	{
		type: "ISP_EU",
		icon: "/tariff-resident.svg",
		title: T("main.proxyTypes.ispEu.title"),
		description: stripHtml(T("main.proxyTypes.ispEu.description")),
		features: [
			T("main.proxyTypes.ispEu.features.multigeo"),
			T("main.proxyTypes.ispEu.features.speed"),
			T("main.proxyTypes.ispEu.features.rotation")
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
	type: "RESIDENT_PREMIUM" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL" | "MOBILE" | "ISP_USA" | "ISP_EU" | "RESIDENTIAL_LITE",
	prices: Prices,
	packages?: Package[]
): number {
	let p = 0
	if (type === "RESIDENT_PREMIUM") p = prices.resident_premium
	else if (type === "MOBILE_GB") p = prices.mobile_gb
	else if (type === "IPV6_GB") p = prices.ipv6_gb
	else if (type === "PREMIUM_RESIDENTIAL") p = prices.premium_residential
	else if (type === "MOBILE") p = typeof prices.mobile === "number" ? prices.mobile : 0
	else if (type === "ISP_USA") p = prices.isp_usa ?? 0
	else if (type === "ISP_EU") p = prices.isp_eu ?? 0
	else if (type === "RESIDENTIAL_LITE") p = prices.residential_lite ?? 0

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

const ArrowIcon = () => (
	<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M5 12h14" />
		<path d="m12 5 7 7-7 7" />
	</svg>
)

export default function PackageCardsSection({ user, prices, packages, locale }: Props) {
	const router = useRouter()
	const T = (key: string) => t(key, locale)
	// Спринт-гейтинг: прячем отключённые типы (ISP_EU/Lite в Sprint 2).
	const cards = buildCards(T).filter(c => !isProxyTypeDisabled(c.type))

	const priceText = (type: CardType): string | null => {
		if (type === "PREMIUM_MOBILE_PLACEHOLDER") return null
		if (type === "RESIDENT_PREMIUM" || type === "MOBILE_GB" || type === "IPV6_GB" || type === "PREMIUM_RESIDENTIAL" || type === "MOBILE" || type === "ISP_USA" || type === "ISP_EU" || type === "RESIDENTIAL_LITE") {
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
		else if (type === "ISP_USA") tariff = "ISP_USA"
		else if (type === "ISP_EU") tariff = "ISP_EU"
		else if (type === "RESIDENTIAL_LITE") tariff = "RESIDENTIAL_LITE"
		router.push(`${getLocalizedPath("/payment")}?tariff=${tariff}`)
	}

	const renderCard = (card: CardData) => {
		const price = priceText(card.type)
		const isPremium = card.tier === "premium"
		const isSoon = !!card.comingSoon
		const base =
			"relative flex flex-col gap-[18px] overflow-hidden rounded-[22px] p-6 sm:p-8 backdrop-blur-[12px] transition-all duration-300 hover:-translate-y-1.5"
		const skin = isPremium
			? "border border-[#6aa5ff]/40 bg-[radial-gradient(120%_130%_at_100%_0%,rgba(59,130,246,0.18),rgba(255,255,255,0.02)_52%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_36px_70px_-42px_rgba(59,130,246,0.6)] light:border-[#2f6bff]/40 light:bg-[radial-gradient(120%_130%_at_100%_0%,rgba(47,107,255,0.1),#fff_52%)]"
			: "border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.012] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-[#6aa5ff]/40 light:border-[#ececf1] light:from-white light:to-white light:shadow-[0_1px_2px_rgba(14,16,25,0.04)] light:hover:border-[#2f6bff]/40"

		return (
			<article key={card.type} className={`${base} ${skin}`}>
				{isPremium && (
					<>
						{/* синий акцент, растворяющийся из левого нижнего угла */}
						<span
							aria-hidden
							className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,107,255,0.5),transparent_70%)] blur-[60px] light:bg-[radial-gradient(circle,rgba(47,107,255,0.18),transparent_72%)]"
						/>
						<span className="absolute right-[22px] top-[22px] z-[1] rounded-full bg-gradient-to-b from-[#6aa5ff] to-[#2f6bff] px-3 py-1.5 text-[11px] font-bold tracking-[0.1em] text-white shadow-[0_8px_24px_-8px_rgba(59,130,246,0.8)]">PREMIUM</span>
					</>
				)}

				<div className={`flex items-center gap-3.5 ${isPremium ? "pr-[78px]" : ""}`}>
					<span className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-[15px] border border-white/[0.14] bg-white/[0.06] light:border-[#2f6bff]/20 light:bg-[#2f6bff]/[0.08]">
						<Image src={card.icon} alt="" width={26} height={26} className="[filter:brightness(0)_saturate(100%)_invert(66%)_sepia(58%)_saturate(900%)_hue-rotate(187deg)_brightness(101%)] light:[filter:brightness(0)_saturate(100%)_invert(31%)_sepia(98%)_saturate(1400%)_hue-rotate(203deg)]" />
					</span>
					<h3 className="font-[TalosDisplay] text-[22px] font-semibold tracking-[-0.02em] text-white light:text-[#0e1019]">{card.title}</h3>
				</div>

				<p className="text-[14px] leading-[1.55] text-white/55 light:text-[#667085]">{card.description}</p>

				<ul className="flex flex-col gap-[11px]">
					{card.features.map((f, i) => (
						<li key={i} className="flex items-center gap-3 text-[14px] text-white/80 light:text-[#3c4250]">
							<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#6aa5ff] to-[#2f6bff] text-white shadow-[0_4px_12px_-4px_rgba(59,130,246,0.8)]"><CheckIcon /></span>
							<span>{f}</span>
						</li>
					))}
				</ul>

				<div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-4 border-t border-white/[0.08] pt-5 light:border-[#ececf1]">
					<div className="font-[TalosDisplay] text-[18px] font-semibold text-white light:text-[#0e1019]">{price ?? T("main.proxyTypes.comingSoon")}</div>
					{isSoon ? (
						<span aria-disabled="true" className="inline-flex h-[42px] cursor-default items-center gap-2 rounded-full border border-white/[0.16] bg-white/[0.05] px-[22px] text-[14px] font-semibold text-white/50 light:border-[#ececf1] light:bg-[#f7f8fb] light:text-[#98a0ad]">
							<span className="h-[7px] w-[7px] rounded-full bg-[#ffd964] shadow-[0_0_8px_#ffd964]" />
							{T("main.proxyTypes.comingSoon")}
						</span>
					) : (
						<button
							type="button"
							onClick={() => onClick(card.type)}
							className={`inline-flex h-[42px] items-center gap-2 rounded-full px-[22px] font-[TalosRethink] text-[14px] font-semibold transition-all duration-200 ${
								isPremium
									? "border border-white/20 bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-white shadow-[0_12px_30px_-12px_rgba(59,130,246,0.9)] hover:-translate-y-0.5"
									: "border border-white/[0.14] bg-white/[0.05] text-white hover:border-[#6aa5ff]/50 light:border-[#ececf1] light:bg-white light:text-[#0e1019] light:hover:border-[#2f6bff] light:hover:text-[#2f6bff]"
							}`}
						>
							{T("main.proxyTypes.more")}
							<ArrowIcon />
						</button>
					)}
				</div>
			</article>
		)
	}

	const standard = cards.filter(c => c.tier === "standard")
	const premium = cards.filter(c => c.tier === "premium")

	// Нечётное число карточек в 2-колоночной сетке → последняя одна в ряду.
	// Центрируем её (span на 2 колонки + половина ширины + по центру).
	const centerLastStandard = standard.length % 2 === 1
		? "[&>*:last-child]:md:col-span-2 [&>*:last-child]:md:w-[calc(50%-11px)] [&>*:last-child]:md:justify-self-center"
		: ""

	const groupHead = "flex flex-col items-center gap-3 text-center"
	const groupTitle = "font-[TalosDisplay] text-[clamp(26px,3.2vw,38px)] font-semibold tracking-[-0.03em] text-white light:text-[#0e1019]"
	const groupSub = "max-w-[540px] text-[15px] leading-[1.5] text-white/55 light:text-[#667085]"

	return (
		<section className="mx-auto flex w-full max-w-[1180px] flex-col gap-[clamp(44px,5vw,64px)] px-5 sm:px-6 md:px-10">
			<div className="flex flex-col gap-7">
				<div className={groupHead}>
					<h3 className={groupTitle}>{T("main.proxyTypes.standardTitle")}</h3>
					<p className={groupSub}>{T("main.proxyTypes.standardSubtitle")}</p>
				</div>
				<div className={`grid grid-cols-1 gap-[22px] md:grid-cols-2 ${centerLastStandard}`}>{standard.map(renderCard)}</div>
			</div>

			{premium.length > 0 && (
				<div className="flex flex-col gap-7">
					<div className={groupHead}>
						<h3 className={groupTitle}>{T("main.proxyTypes.premiumTitle")}</h3>
						<p className={groupSub}>{T("main.proxyTypes.premiumSubtitle")}</p>
					</div>
					<div className="grid grid-cols-1 gap-[22px] md:grid-cols-2">{premium.map(renderCard)}</div>
				</div>
			)}
		</section>
	)
}
