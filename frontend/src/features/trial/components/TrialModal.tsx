"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"
import type { FC } from "react"

import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import { useTrial } from "@/features/trial/hooks/useTrial"
import { accountLinkService } from "@/features/user/services/account-link.service"
import { useTelegramLink } from "@/features/user/hooks/useTelegramLink"
import type { User } from "@/features/user/types/user.types"

type TariffMeta = {
	type: "RESIDENT_PREMIUM" | "MOBILE_GB" | "IPV6_GB"
	tKey: string
	icon: string
	tagline: string
}

const TARIFFS: TariffMeta[] = [
	{ type: "RESIDENT_PREMIUM", tKey: "resident", icon: "/tariff-resident.svg", tagline: "150M+ IPs · global pool" },
	{ type: "MOBILE_GB", tKey: "mobileGb", icon: "/tariff-mobile-gb.svg", tagline: "4G · 5G · carrier-grade" },
	{ type: "IPV6_GB", tKey: "ipv6", icon: "/tariff-ipv6.svg", tagline: "Server IPv6 · стабильный" }
]

const SparkIcon = () => (
	<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
		<path d="M7 0L8.6 4.4L13 5.5L8.6 6.6L7 11L5.4 6.6L1 5.5L5.4 4.4L7 0Z" fill="currentColor" />
	</svg>
)

const CheckIcon = () => (
	<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
		<path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const ArrowRightIcon = () => (
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<path d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const LinkIcon = () => (
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<path d="M7 9C7.4 9.4 8 9.6 8.6 9.6C9.2 9.6 9.8 9.4 10.2 9L13 6.2C13.4 5.8 13.6 5.2 13.6 4.6C13.6 4 13.4 3.4 13 3C12.6 2.6 12 2.4 11.4 2.4C10.8 2.4 10.2 2.6 9.8 3L9.4 3.4M9 7C8.6 6.6 8 6.4 7.4 6.4C6.8 6.4 6.2 6.6 5.8 7L3 9.8C2.6 10.2 2.4 10.8 2.4 11.4C2.4 12 2.6 12.6 3 13C3.4 13.4 4 13.6 4.6 13.6C5.2 13.6 5.8 13.4 6.2 13L6.6 12.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const TelegramIcon = () => (
	<svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path d="M16.9095 7.42745L15.2702 16.1954C15.2702 16.1954 15.0408 16.8033 14.4108 16.5118L10.6284 13.435L10.6109 13.4259C11.1218 12.9392 15.0836 9.16005 15.2567 8.98874C15.5248 8.72344 15.3584 8.5655 15.0471 8.76591L9.19506 12.7087L6.93734 11.9028C6.93734 11.9028 6.58204 11.7687 6.54786 11.4772C6.51323 11.1852 6.94903 11.0272 6.94903 11.0272L16.1531 7.1965C16.1531 7.1965 16.9095 6.84387 16.9095 7.42745Z" fill="currentColor" />
	</svg>
)

const Spinner = () => <span className="trial-modal__spinner" aria-hidden="true" />

const TrialModal: FC<{ user?: User | null }> = ({ user }) => {
	const pathname = usePathname()
	const locale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, locale)

	const [selectedIndex, setSelectedIndex] = useState(0)
	const { getTrial, isLoading } = useTrial()
	const { startLink: startTelegramLink } = useTelegramLink()

	const accounts = user?.accounts ?? user?.account ?? []
	const hasVerifiedLink = accounts.some(
		(a) => a.provider === "GOOGLE" || a.provider === "TELEGRAM"
	)

	const handleSubmit = () => {
		getTrial(TARIFFS[selectedIndex].type)
	}

	return (
		<div className="trial-modal">
			{/* Eyebrow + title */}
			<header className="trial-modal__header">
				<span className="trial-modal__eyebrow">
					<SparkIcon />
					{T("trialModal.title")}
				</span>
				<h2 className="trial-modal__title">{T("trialModal.description")}</h2>
			</header>

			{/* HERO: huge gradient traffic value */}
			<section className="trial-modal__hero">
				<span className="trial-modal__hero-eyebrow">{T("trialModal.traffic")}</span>
				<span className="trial-modal__hero-value">{T("trialModal.trafficValue")}</span>
				<span className="trial-modal__hero-caption">Бесплатно · одноразово</span>
			</section>

			{/* Tariff selector */}
			<section className="trial-modal__section">
				<span className="trial-modal__section-label">Выберите тариф</span>
				<div className="trial-modal__tariffs">
					{TARIFFS.map((tariff, i) => {
						const isActive = selectedIndex === i
						return (
							<button
								key={tariff.type}
								type="button"
								className={`trial-tariff ${isActive ? "trial-tariff--active" : ""}`}
								onClick={() => setSelectedIndex(i)}
								aria-pressed={isActive}
							>
								<span className="trial-tariff__icon">
									<Image src={tariff.icon} alt="" width={20} height={20} />
								</span>
								<span className="trial-tariff__body">
									<span className="trial-tariff__title">{T(`trialModal.tariffs.${tariff.tKey}`)}</span>
									<span className="trial-tariff__tagline">{tariff.tagline}</span>
								</span>
								<span className={`trial-tariff__mark ${isActive ? "trial-tariff__mark--on" : ""}`} aria-hidden="true">
									{isActive && <CheckIcon />}
								</span>
							</button>
						)
					})}
				</div>
			</section>

			{/* Link section (blue, next-step framing) */}
			{!hasVerifiedLink && (
				<section className="trial-modal__link">
					<div className="trial-modal__link-head">
						<span className="trial-modal__link-icon" aria-hidden="true"><LinkIcon /></span>
						<div className="trial-modal__link-text">
							<p className="trial-modal__link-title">{T("trialModal.requireLinkTitle")}</p>
							<p className="trial-modal__link-desc">{T("trialModal.requireLinkDescription")}</p>
						</div>
					</div>
					<div className="trial-modal__link-buttons">
						<button
							type="button"
							onClick={() => accountLinkService.startGoogleLink()}
							className="trial-modal__link-btn trial-modal__link-btn--google"
						>
							<Image src="/google-logo.svg" alt="" width={16} height={16} />
							{T("trialModal.linkGoogle")}
						</button>
						<button
							type="button"
							onClick={() => startTelegramLink()}
							className="trial-modal__link-btn trial-modal__link-btn--telegram"
						>
							<TelegramIcon />
							{T("trialModal.linkTelegram")}
						</button>
					</div>
				</section>
			)}

			{/* CTA */}
			<button
				type="button"
				onClick={handleSubmit}
				disabled={isLoading || !hasVerifiedLink}
				className="trial-modal__cta"
				aria-busy={isLoading}
				title={!hasVerifiedLink ? T("trialModal.requireLinkTitle") : undefined}
			>
				{isLoading ? (
					<Spinner />
				) : (
					<>
						<span>{T("trialModal.getButton")}</span>
						<ArrowRightIcon />
					</>
				)}
			</button>
		</div>
	)
}

export default TrialModal
