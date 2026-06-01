import type { FC } from "react"
import Image from "next/image"
import type { SupportedLocale } from "@/shared/utils/i18n"

type ProxyTypeCardProps = {
	isActive: boolean
	onSelect: () => void
	label: string
	description: string
	price: string
	icon?: string
	tier?: "standard" | "premium"
	comingSoon?: boolean
	locale?: SupportedLocale
}

const CheckIcon = () => (
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<path d="M3 8L7 12L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const ProxyTypeCard: FC<ProxyTypeCardProps> = ({
	isActive,
	onSelect,
	label,
	description,
	price,
	icon,
	tier = "standard",
	comingSoon = false
}) => {
	const resolvedIcon =
		icon ?? (tier === "premium" ? "/tariff-premium.svg" : label.toLowerCase().includes("mobile") ? "/tariff-mobile-gb.svg" : "/tariff-resident.svg")
	const isPremium = tier === "premium"
	const cls = [
		"pay-tier-card",
		isPremium && "pay-tier-card--premium",
		isActive && "pay-tier-card--active",
		comingSoon && "pay-tier-card--coming-soon"
	].filter(Boolean).join(" ")

	return (
		<button
			type="button"
			disabled={comingSoon}
			className={cls}
			onClick={() => { if (!comingSoon) onSelect() }}
			aria-pressed={isActive}
		>
			{isPremium && !isActive && <span className="pay-tier-card__badge">PREMIUM</span>}
			{isActive && (
				<span className="pay-tier-card__active-mark" aria-label="selected">
					<CheckIcon />
				</span>
			)}
			{isPremium && isActive && <span className="pay-tier-card__badge">PREMIUM</span>}

			<div className="pay-tier-card__head">
				<span className="pay-tier-card__icon">
					<Image src={resolvedIcon} alt="" width={24} height={24} />
				</span>
				<h3 className="pay-tier-card__title">{label}</h3>
			</div>

			<p className="pay-tier-card__desc">{description}</p>

			<div className="pay-tier-card__price">{price}</div>
		</button>
	)
}

export default ProxyTypeCard
