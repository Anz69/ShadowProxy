import { Fragment, type ReactNode } from "react"
import Link from "next/link"
import { Zap, Wallet, ArrowUpToLine, BarChart3, ShieldCheck, Activity, Gauge, RefreshCw, Receipt, Globe, Code2, UserPlus, SlidersHorizontal, Rocket } from "lucide-react"

import { getUser } from "@/shared/server/getUser"
import { getT } from "@/shared/server/getT"
import { getLocale } from "@/shared/server/getLocale"
import { getLocalizedLink } from "@/shared/server/getLocalizedLink"
import { getPrices } from "@/shared/server/getPrices"
import { getPackages } from "@/shared/server/getPackages"
import Layout from "@/shared/components/ui/Layout"
import PackageCardsSection from "./components/PackageCardsSection"
import FaqSection from "./components/FaqSection"
import StackScroll from "./components/StackScroll"
import HeroAtmosphere from "./components/HeroAtmosphere"
import ProxyGlobe from "@/shared/components/widgets/ProxyGlobe"

import "./home-talos.css"

export const dynamic = "force-dynamic"

/* Reusable Tailwind class strings (composition, not custom CSS classes). */
const cx = {
	container: "mx-auto w-full max-w-[1180px] px-5 sm:px-6 md:px-10 translate-y-4 sm:translate-y-10",
	eyebrow:
		"inline-flex w-max items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-[13px] font-semibold tracking-[0.01em] text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-md light:border-[#2f6bff]/25 light:bg-[#2f6bff]/10 light:text-[#2f6bff]",
	dot: "inline-block h-2 w-2 rounded-full bg-gradient-to-br from-[#6aa5ff] to-[#34d3ee] shadow-[0_0_12px_rgba(106,165,255,0.9)]",
	h2: "font-[TalosDisplay] text-[clamp(30px,4vw,48px)] font-semibold leading-[1.06] tracking-[-0.03em] text-white light:text-[#0e1019]",
	sub: "max-w-[540px] text-[16px] leading-[1.55] text-white/55 light:text-[#667085]",
	card:
		"relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[12px] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#6aa5ff]/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_56px_-38px_rgba(59,130,246,0.5)] light:border-[#ececf1] light:bg-white light:shadow-[0_1px_2px_rgba(14,16,25,0.04)] light:hover:border-[#2f6bff]/40",
	chip:
		"inline-flex h-[54px] w-[54px] items-center justify-center rounded-[16px] border border-[#6aa5ff]/30 bg-gradient-to-b from-[#6aa5ff]/20 to-[#3b82f6]/[0.08] shadow-[0_10px_24px_-12px_rgba(59,130,246,0.8)] light:border-[#2f6bff]/20 light:bg-[#2f6bff]/[0.08] light:shadow-none",
	btnPrimary:
		"inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-7 font-[TalosRethink] text-[15px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform duration-200 hover:-translate-y-0.5",
	btnGhost:
		"inline-flex h-[52px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-7 font-[TalosRethink] text-[15px] font-semibold text-white backdrop-blur transition-colors duration-200 hover:bg-white/10 light:border-[#e2e4ea] light:bg-white light:text-[#0e1019] light:hover:border-[#2f6bff] light:hover:text-[#2f6bff]",
	// Scroll-stack card: sticks under the header; the next card is a strong
	// frosted-glass sheet that slides over it, blurring the one going under.
	panel:
		"sticky top-[88px] sm:top-[116px] w-full origin-top overflow-hidden rounded-[20px] sm:rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] py-[clamp(30px,5vw,84px)] shadow-[0_-24px_70px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] [will-change:transform,filter,opacity] light:border-[#e6e8ef] light:bg-[linear-gradient(180deg,#ffffff,#f6f8fc)] light:shadow-[0_-20px_60px_-46px_rgba(14,16,25,0.24),inset_0_1px_0_rgba(255,255,255,0.95)]"
}

/** Render the small controlled HTML in our i18n strings (<span>, <br/>) as JSX. */
function renderRich(raw: string): ReactNode[] {
	return raw
		.split(/(<br\s*\/?>|<span>[\s\S]*?<\/span>)/g)
		.filter(Boolean)
		.map((tok, i) => {
			if (/^<br\s*\/?>$/.test(tok)) return <br key={i} />
			const m = tok.match(/^<span>([\s\S]*?)<\/span>$/)
			if (m) return <span key={i} className="bg-gradient-to-r from-[#6aa5ff] to-[#34d3ee] bg-clip-text text-transparent light:from-[#2f6bff] light:to-[#2f6bff]">{m[1]}</span>
			return <Fragment key={i}>{tok}</Fragment>
		})
}

const Check = () => (
	<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
		<path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const featureItems = [
	{ key: "verified", Icon: ShieldCheck },
	{ key: "uptime", Icon: Activity },
	{ key: "stability", Icon: Gauge },
	{ key: "auto", Icon: RefreshCw },
	{ key: "transparent", Icon: Receipt },
	{ key: "geo", Icon: Globe },
	{ key: "api", Icon: Code2 }
]
const stepItems = [
	{ key: "step1", Icon: UserPlus },
	{ key: "step2", Icon: Wallet },
	{ key: "step3", Icon: SlidersHorizontal },
	{ key: "step4", Icon: Rocket }
]
const trustPoints = ["speed", "anon", "ip", "abuse", "stability"] as const
const apiIcons = [Zap, Wallet, ArrowUpToLine, BarChart3]

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
			<main className="home-talos relative z-[1] -mt-6 flex flex-col gap-[clamp(72px,7vw,120px)] bg-[#060d1e] pb-2 font-[TalosInter] text-white light:bg-[#eceff5] light:text-[#0e1019]">

				{/* Interactive atmosphere — grid + aurora parallax on cursor, drift, spotlight */}
				<HeroAtmosphere />

				{/* Hero */}
				<section className={`${cx.container} pt-2`}>
					<div className="relative px-0 py-[clamp(44px,5vw,88px)] sm:px-6 md:px-16">
						<div className="relative z-[2] flex flex-col items-center gap-[clamp(28px,3vw,44px)]">
							<div className="flex max-w-[860px] flex-col items-center gap-6 text-center">
								<span className={cx.eyebrow}><span className={cx.dot} />{T("main.hero.eyebrow")}</span>
								<h1 className="font-[TalosDisplay] text-[clamp(32px,5.6vw,66px)] font-semibold leading-[1.06] tracking-[-0.035em] text-white [text-shadow:0_2px_40px_rgba(59,130,246,0.25)] light:text-[#0e1019] light:[text-shadow:none]">
									{renderRich(T("main.hero.title"))}
								</h1>
								<p className="max-w-[600px] text-[clamp(16px,1.5vw,19px)] leading-[1.55] text-white/65 light:text-[#667085]">{T("main.hero.description")}</p>
								<div className="flex w-full flex-col items-stretch justify-center gap-3.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
									<Link href={registerLink} className={`${cx.btnPrimary} w-full sm:w-auto`}>{T("main.hero.cta.primary")}</Link>
									<Link href={apiLink} className={`${cx.btnGhost} w-full sm:w-auto`}>{T("main.hero.cta.secondary")}</Link>
								</div>
								<div className="mt-1 flex flex-wrap items-center justify-center gap-[clamp(22px,4vw,56px)]">
									{[["200+", T("main.hero.stats.countries")], ["90M+", T("main.hero.stats.pool")], ["99.9%", T("main.hero.stats.uptime")]].map(([n, l], i) => (
										<Fragment key={i}>
											{i > 0 && <span className="hidden h-9 w-px bg-white/15 sm:block light:bg-[#e2e4ea]" />}
											<div className="flex flex-col gap-0.5">
												<b className="font-[TalosDisplay] text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em] text-white light:text-[#0e1019]">{n}</b>
												<span className="text-[13px] text-white/45 light:text-[#98a0ad]">{l}</span>
											</div>
										</Fragment>
									))}
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Slim section divider — fading hairlines + a glowing accent diamond */}
				<div aria-hidden className={`${cx.container} -my-[clamp(24px,3.5vw,56px)] flex items-center justify-center gap-4`}>
					<span className="h-px w-full max-w-[300px] bg-gradient-to-r from-transparent to-white/15 light:to-[#0e1019]/12" />
					<span className="h-1.5 w-1.5 shrink-0 rotate-45 rounded-[2px] bg-gradient-to-br from-[#6aa5ff] to-[#34d3ee] shadow-[0_0_14px_rgba(106,165,255,0.75)]" />
					<span className="h-px w-full max-w-[300px] bg-gradient-to-l from-transparent to-white/15 light:to-[#0e1019]/12" />
				</div>

				{/* Global network — interactive globe */}
				<section className={cx.container}>
					<div className="grid items-center gap-[clamp(36px,5vw,80px)] lg:grid-cols-2">
						{/* Globe */}
						<div className="relative order-1 flex items-center justify-center lg:order-none">
							<div className="relative mx-auto w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[520px]">
								<span aria-hidden className="pointer-events-none absolute inset-0 m-auto h-[78%] w-[78%] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(79,141,255,0.22),transparent_70%)] blur-[40px] light:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(47,107,255,0.14),transparent_70%)]" />
								<ProxyGlobe size={520} className="relative z-[1] mx-auto block" />
							</div>
						</div>

						{/* Text */}
						<div className="order-2 flex flex-col items-start gap-[22px] lg:order-none">
							<span className={cx.eyebrow}><span className={cx.dot} />{T("main.globe.eyebrow")}</span>
							<h2 className={cx.h2}>{renderRich(T("main.globe.title"))}</h2>
							<p className={cx.sub}>{T("main.globe.subtitle")}</p>
							<div className="flex items-center gap-x-[clamp(22px,4vw,56px)] gap-y-4">
								{[["200+", T("main.globe.points.countries")], ["90M+", T("main.globe.points.pool")], ["99.9%", T("main.globe.points.uptime")]].map(([n, l], i) => (
									<Fragment key={i}>
										{i > 0 && <span className="hidden h-9 w-px bg-white/15 sm:block light:bg-[#e2e4ea]" />}
										<div className="flex flex-col gap-0.5">
											<b className="font-[TalosDisplay] text-[clamp(24px,3vw,32px)] font-bold tracking-[-0.02em] text-white light:text-[#0e1019]">{n}</b>
											<span className="text-[13px] text-white/45 light:text-[#98a0ad]">{l}</span>
										</div>
									</Fragment>
								))}
							</div>
							<Link href={registerLink} className={`${cx.btnPrimary} mt-1 w-full sm:w-auto`}>{T("main.globe.cta")}</Link>
						</div>
					</div>
				</section>

				{/* Proxy tiers */}
				<PackageCardsSection user={user} prices={prices} packages={packages} locale={locale} />

				{/* ── Scroll-stack: each card pins under the header, the next slides over it ── */}
				<div className="relative mx-auto flex w-full max-w-[1240px] flex-col gap-[clamp(22px,2.6vw,40px)] px-4 sm:px-6">
					<StackScroll />

					{/* Features */}
					<section data-stack-card className={`${cx.panel} z-[1]`}>
						<div className={cx.container}>
							<div className="mb-[clamp(36px,4vw,54px)] flex flex-col items-center gap-4 text-center">
								<span className={cx.eyebrow}><span className={cx.dot} />{T("main.features.eyebrow")}</span>
								<h2 className={`${cx.h2} max-w-[760px]`}>{T("main.features.title")}</h2>
							</div>
							<div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
								{featureItems.map(({ key, Icon }) => (
									<div key={key} className={`${cx.card} flex min-h-[200px] flex-col justify-between gap-5 p-6 sm:p-[26px]`}>
										<span className={`${cx.chip} relative z-[1]`}>
											<Icon size={24} strokeWidth={1.9} className="text-[#6aa5ff] light:text-[#2f6bff]" aria-hidden />
										</span>
										<p className="relative z-[1] max-w-[94%] font-[TalosDisplay] text-[18px] font-semibold leading-[1.25] tracking-[-0.02em] text-white light:text-[#0e1019]">{T(`main.features.items.${key}`)}</p>
									</div>
								))}
							</div>
						</div>
					</section>

					{/* Steps */}
					<section data-stack-card className={`${cx.panel} z-[2]`}>
						<div className={cx.container}>
							<div className="mb-[clamp(36px,4vw,54px)] flex flex-col items-center gap-4 text-center">
								<span className={cx.eyebrow}><span className={cx.dot} />{T("main.steps.eyebrow")}</span>
								<h2 className={`${cx.h2} max-w-[760px]`}>{T("main.steps.title")}</h2>
							</div>
							<div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
								{stepItems.map(({ key, Icon }, i) => (
									<div key={key} className={`${cx.card} flex min-h-[210px] flex-col justify-between gap-7 p-6 sm:p-[26px]`}>
										<div className="flex items-start justify-between">
											<span className={cx.chip}>
												<Icon size={24} strokeWidth={1.9} className="text-[#6aa5ff] light:text-[#2f6bff]" aria-hidden />
											</span>
											<span className="font-[TalosDisplay] text-[28px] font-bold leading-none text-white/15 light:text-[#d6dae3]">{`0${i + 1}`}</span>
										</div>
										<h3 className="font-[TalosDisplay] text-[18px] font-semibold leading-[1.22] tracking-[-0.02em] text-white light:text-[#0e1019]">{T(`main.steps.items.${key}.title`)}</h3>
									</div>
								))}
							</div>
						</div>
					</section>

					{/* Trust */}
					<section data-stack-card className={`${cx.panel} z-[3]`}>
						<div className={cx.container}>
							<div className="relative">
								<span aria-hidden className="pointer-events-none absolute -left-10 -top-10 h-[280px] w-[280px] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(79,141,255,0.18),transparent_70%)] blur-[40px] light:opacity-50" />
								<div className="relative z-[2] grid items-center gap-[clamp(28px,4vw,64px)] lg:grid-cols-[1.05fr_0.95fr]">
									<div className="flex flex-col items-start gap-[18px]">
										<span className={cx.eyebrow}><span className={cx.dot} />{T("main.trust.label")}</span>
										<h2 className="font-[TalosDisplay] text-[clamp(28px,3.4vw,46px)] font-semibold leading-[1.1] tracking-[-0.03em] text-white light:text-[#0e1019]">
											{T("main.trust.titlePre")}
											<span className="bg-gradient-to-r from-[#6aa5ff] to-[#34d3ee] bg-clip-text text-transparent light:from-[#2f6bff] light:to-[#2f6bff]">{T("main.trust.titleAccent")}</span>
											{T("main.trust.titlePost")}
										</h2>
									</div>
									<div className="flex flex-col items-start gap-[22px]">
										<p className="text-[16px] leading-[1.6] text-white/65 light:text-[#667085]">{T("main.trust.text")}</p>
										<ul className="flex w-full flex-col gap-[13px]">
											{trustPoints.map(k => (
												<li key={k} className="flex items-center gap-3 text-[15px] text-white/80 light:text-[#3c4250]">
													<span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#6aa5ff] to-[#2f6bff] text-white shadow-[0_4px_12px_-4px_rgba(59,130,246,0.8)]"><Check /></span>
													{T(`main.trust.points.${k}`)}
												</li>
											))}
										</ul>
										<Link href={registerLink} className={cx.btnPrimary}>{T("main.trust.cta")}</Link>
									</div>
								</div>
							</div>
						</div>
					</section>

					{/* API system */}
					<section data-stack-card className={`${cx.panel} z-[4]`}>
						<div className={cx.container}>
							<div className="flex flex-col items-center gap-[clamp(32px,4vw,48px)] text-center">
								<span className={cx.eyebrow}><span className={cx.dot} />{T("main.apiSystem.eyebrow")}</span>
								<h2 className={cx.h2}>{T("main.apiSystem.title")}</h2>
								<div className="grid w-full grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
									{[0, 1, 2, 3].map(i => {
										const Icon = apiIcons[i]
										return (
											<div key={i} className={`${cx.card} flex min-h-[162px] flex-col gap-4 p-6 sm:p-[26px] text-left`}>
												<div className="flex items-center justify-between">
													<span className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-[14px] border border-[#6aa5ff]/30 bg-gradient-to-b from-[#6aa5ff]/20 to-[#3b82f6]/[0.08] text-[#6aa5ff] light:border-[#2f6bff]/20 light:bg-[#2f6bff]/[0.08] light:text-[#2f6bff]"><Icon size={21} /></span>
													<span className="font-[TalosDisplay] text-[26px] font-bold text-white/15 light:text-[#d6dae3]">{`0${i + 1}`}</span>
												</div>
												<p className="mt-auto text-[14px] leading-[1.5] text-white/55 light:text-[#667085]">{renderRich(T(`main.apiSystem.steps.step${i + 1}`))}</p>
											</div>
										)
									})}
								</div>
								<Link href={apiLink} className={cx.btnPrimary}>{T("main.apiSystem.cta")}</Link>
							</div>
						</div>
					</section>

				</div>

				{/* FAQ */}
				<FaqSection locale={locale} />

				{/* Pre-footer CTA + Footer are rendered once in app/(app)/layout.tsx */}
			</main>
		</Layout>
	)
}
