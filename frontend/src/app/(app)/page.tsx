import Link from "next/link"

import { getUser } from "@/shared/server/getUser"
import { getT } from "@/shared/server/getT"
import { getLocale } from "@/shared/server/getLocale"
import { getLocalizedLink } from "@/shared/server/getLocalizedLink"
import { getPrices } from "@/shared/server/getPrices"
import { getPackages } from "@/shared/server/getPackages"
import Layout from "@/shared/components/ui/Layout"
import Reveals from "@/shared/anim/Reveals"
import PackageCardsSection from "./components/PackageCardsSection"

export const dynamic = "force-dynamic"

export default async function Home() {
	const user = await getUser()
	const T = await getT()
	const locale = await getLocale()
	const prices = await getPrices()
	const packages = await getPackages()
	const apiLink = await getLocalizedLink("/u-api")
	const registerLink = await getLocalizedLink("/auth/register")

	return (
		<Layout user={user} locale={locale}>
			{/* Main Content */}
			<main style={{ display: 'contents' }}>
				<Reveals
					config={[
						{ selector: ".hero__text > *", variant: "rise", stagger: 0.14, duration: 1.1, immediate: true },
						{ selector: ".proxy-tier-group__head", variant: "up", duration: 0.9 },
						{ selector: ".proxy-tier-card", variant: "blur", stagger: 0.1, duration: 0.95 },
						{ selector: ".section-features .section-title", variant: "rise", duration: 0.95 },
						{ selector: ".feat-card", variant: "rise", stagger: 0.08, duration: 0.9 },
						{ selector: ".section-steps .section-title", variant: "rise", duration: 0.95 },
						{ selector: ".step-card", variant: "blur", stagger: 0.1, duration: 0.95 },
						{ selector: ".trust-block__inner", variant: "scale", duration: 1.0 },
						{ selector: ".api-system__title", variant: "rise", duration: 0.95 },
						{ selector: ".api-step", variant: "rise", stagger: 0.1, duration: 0.9 }
					]}
				/>
				{/* Hero Section */}
				<section className="hero">
					<div className="hero__container">
						<div className="hero__text">
							<h1 className="main-title" dangerouslySetInnerHTML={{ __html: T("main.hero.title") }} />
							<p className="hero-desc white-text">
								{T("main.hero.description")}
							</p>
							<div className="hero__actions">
								<Link href={registerLink} className="btn-primary blue">{T("main.hero.cta.primary")}</Link>
								<Link href={apiLink} className="btn-primary gray">{T("main.hero.cta.secondary")}</Link>
							</div>
						</div>
					</div>
				</section>

				{/* Proxy Types Section */}
				<PackageCardsSection user={user} prices={prices} packages={packages} locale={locale} />

				{/* Features Section - Почему выбирают нас */}
				<section className="section section-features">
					<h2 className="section-title">{T("main.features.title")}</h2>
					<div className="features-grid">
							<div className="feat-card">
								<div className="feat-icon">
									<img src="/check.svg" alt="" className="feat-icon-default" />
									<img src="/check-hover.svg" alt="" className="feat-icon-hover" />
								</div>
								<p>{T("main.features.items.verified")}</p>
							</div>
							<div className="feat-card">
								<div className="feat-icon purple">
									<img src="/uptime.svg" alt="" className="feat-icon-default" />
									<img src="/uptime-hover.svg" alt="" className="feat-icon-hover" />
								</div>
								<p>{T("main.features.items.uptime")}</p>
							</div>
							<div className="feat-card">
								<div className="feat-icon blue-light">
									<img src="/arrow-up.svg" alt="" className="feat-icon-default" />
									<img src="/arrow-up-hover.svg" alt="" className="feat-icon-hover" />
								</div>
								<p>{T("main.features.items.stability")}</p>
							</div>
							<div className="feat-card">
								<div className="feat-icon dark">
									<img src="/auto.svg" alt="" className="feat-icon-default" />
									<img src="/auto-hover.svg" alt="" className="feat-icon-hover" />
								</div>
								<p>{T("main.features.items.auto")}</p>
							</div>
							<div className="feat-card">
								<div className="feat-icon">
									<img src="/docs.svg" alt="" className="feat-icon-default" />
									<img src="/docs-hover.svg" alt="" className="feat-icon-hover" />
								</div>
								<p>{T("main.features.items.transparent")}</p>
							</div>
							<div className="feat-card">
								<div className="feat-icon globe">
									<img src="/globe.svg" alt="" className="feat-icon-default" />
									<img src="/globe-hover.svg" alt="" className="feat-icon-hover" />
								</div>
								<p>{T("main.features.items.geo")}</p>
							</div>
							<div className="feat-card">
								<div className="feat-icon plus">
									<img src="/plus.svg" alt="" className="feat-icon-default" />
									<img src="/plus-hover.svg" alt="" className="feat-icon-hover" />
								</div>
								<p>{T("main.features.items.api")}</p>
							</div>
						</div>
				</section>

				{/* Steps Section */}
				<section className="section section-steps">
					<h2 className="section-title">{T("main.steps.title")}</h2>
					<div className="steps__grid">
						<div className="step-card">
							<div className="step-card__top">
								<div className="step-card__content">
									<div className="step-card__icon">
										<img src="/step-1.svg" alt={T("main.steps.items.step1.alt")} />
									</div>
								</div>
								<span className="step-card__number">01</span>
							</div>
							<h3 className="step-card__title">{T("main.steps.items.step1.title")}</h3>
						</div>

						<div className="step-card">
							<div className="step-card__top">
								<div className="step-card__content">
									<div className="step-card__icon">
										<img src="/step-2.svg" alt={T("main.steps.items.step2.alt")} />
									</div>
								</div>
								<span className="step-card__number">02</span>
							</div>
							<h3 className="step-card__title">{T("main.steps.items.step2.title")}</h3>
						</div>

						<div className="step-card">
							<div className="step-card__top">
								<div className="step-card__content">
									<div className="step-card__icon">
										<img src="/step-3.svg" alt={T("main.steps.items.step3.alt")} />
									</div>
								</div>
								<span className="step-card__number">03</span>
							</div>
							<h3 className="step-card__title">{T("main.steps.items.step3.title")}</h3>
						</div>

						<div className="step-card">
							<div className="step-card__top">
								<div className="step-card__content">
									<div className="step-card__icon">
										<img src="/step-4.svg" alt={T("main.steps.items.step4.alt")} />
									</div>
								</div>
								<span className="step-card__number">04</span>
							</div>
							<h3 className="step-card__title">{T("main.steps.items.step4.title")}</h3>
						</div>
					</div>
				</section>

				{/* Trust Block */}
				<section className="trust-block">
					<div className="trust-block__inner">
							<div className="trust-block__content">
								<span className="trust-block__label">{T("main.trust.label")}</span>
								<h2 className="trust-block__title" dangerouslySetInnerHTML={{ __html: T("main.trust.title") }} />
							</div>

							<div className="trust-block__info">
								<p className="trust-block__text">
									{T("main.trust.text")}
								</p>
								<Link href={registerLink} className="btn-primary blue">{T("main.trust.cta")}</Link>
							</div>
						</div>
				</section>

				{/* API System Section */}
				<section className="api-system">
					<div className="api-system__container">
						<div className="api-system__content">
							<h2 className="api-system__title">{T("main.apiSystem.title")}</h2>
							<div className="api-steps">
								<div className="api-step">
									<span className="api-step__number">01</span>
									<p className="api-step__text" dangerouslySetInnerHTML={{ __html: T("main.apiSystem.steps.step1") }} />
								</div>
								<div className="api-step">
									<span className="api-step__number">02</span>
									<p className="api-step__text">{T("main.apiSystem.steps.step2")}</p>
								</div>
								<div className="api-step">
									<span className="api-step__number">03</span>
									<p className="api-step__text" dangerouslySetInnerHTML={{ __html: T("main.apiSystem.steps.step3") }} />
								</div>
								<div className="api-step">
									<span className="api-step__number">04</span>
									<p className="api-step__text">{T("main.apiSystem.steps.step4")}</p>
								</div>
							</div>
							<Link href={apiLink} className="btn-primary blue api-docs-btn">{T("main.apiSystem.cta")}</Link>
						</div>
					</div>
				</section>

			</main>
		</Layout>
	)
}
