"use client"

import { Zap, Code2 } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type FC } from "react"

import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

type Props = { locale?: SupportedLocale }

/**
 * Standalone pre-footer call-to-action. Sits on the page background (not inside
 * the footer panel) above the footer, with a perspective grid + a breathing
 * horizon glow. Rendered once in the (app) layout so every content page gets
 * the exact same treatment as the landing.
 */
// Маркетинговый CTA не нужен на аккаунт-страницах (личный кабинет, оплата,
// пакеты, API, рефералка, админка) — там он только удлиняет скролл «в никуда».
// Показываем только на маркетинговых страницах (главная, каталог, legal).
const CTA_HIDDEN_ROUTES = [
	"/dashboard", "/balance", "/payment", "/payment-time", "/packages",
	"/api", "/u-api", "/referral", "/ref", "/admin", "/reviews"
]

const PreFooterCTA: FC<Props> = ({ locale: localeProp }) => {
	const pathname = usePathname()
	// Источник истины — URL (реактивен к смене языка), а не залипающий серверный prop.
	const locale = getLocaleFromPath(pathname) ?? localeProp
	const link = (path: string) => addLocaleToPath(path, locale)
	const T = (key: string) => t(key, locale)

	// Снимаем префикс локали и проверяем маршрут.
	const route = pathname.replace(/^\/(ru|en|zh-CN)(?=\/|$)/, "") || "/"
	if (CTA_HIDDEN_ROUTES.some(r => route === r || route.startsWith(r + "/"))) {
		return null
	}

	const btnPrimary =
		"inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] px-7 font-[TalosRethink] text-[15px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform duration-200 hover:-translate-y-0.5 sm:w-auto"
	const btnGhost =
		"inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-7 font-[TalosRethink] text-[15px] font-semibold text-white backdrop-blur transition-colors duration-200 hover:bg-white/10 sm:w-auto light:border-[#e2e4ea] light:bg-white light:text-[#0e1019] light:hover:border-[#2f6bff] light:hover:text-[#2f6bff]"

	return (
		<section className="mx-auto w-full max-w-[1180px] px-5 text-center sm:px-6 md:px-10">
			<div className="relative overflow-hidden px-6 pb-[clamp(56px,8vw,120px)]">
				{/* perspective grid */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 bottom-0 -z-[0] h-[78%] bg-[linear-gradient(rgba(120,160,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(120,160,255,0.08)_1px,transparent_1px)] [background-size:50px_50px] [mask-image:radial-gradient(68%_92%_at_50%_120%,#000,transparent_72%)] light:bg-[linear-gradient(rgba(47,107,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(47,107,255,0.06)_1px,transparent_1px)]"
				/>
				{/* breathing horizon glow */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 bottom-[-34%] -z-[0] h-[86%] bg-[radial-gradient(52%_72%_at_50%_100%,rgba(79,141,255,0.42),transparent_70%)] motion-safe:animate-[sp-breathe_6s_ease-in-out_infinite] light:bg-[radial-gradient(52%_72%_at_50%_100%,rgba(47,107,255,0.16),transparent_70%)]"
				/>
				<div className="relative z-[1] flex flex-col items-center gap-6">
					<h2 className="font-[TalosDisplay] text-[clamp(34px,5vw,60px)] font-semibold leading-[1.04] tracking-[-0.035em] text-white light:text-[#0e1019]">
						{T("footer.cta.title")}
					</h2>
					<p className="max-w-[520px] text-[clamp(15px,1.4vw,18px)] leading-[1.55] text-white/60 light:text-[#667085]">
						{T("footer.cta.subtitle")}
					</p>
					<div className="mt-1 flex w-full flex-col items-stretch justify-center gap-3.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
						<Link href={link("/auth/register")} className={btnPrimary}>
							<Zap className="h-[18px] w-[18px]" />
							{T("footer.cta.trial")}
						</Link>
						<Link href={link("/u-api")} className={btnGhost}>
							<Code2 className="h-[18px] w-[18px]" />
							{T("footer.cta.apiDocs")}
						</Link>
					</div>
				</div>
			</div>
		</section>
	)
}

export default PreFooterCTA
