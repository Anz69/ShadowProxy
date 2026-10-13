"use client"

import { Github, Mail, Send, Zap, Code2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type FC, useEffect, useRef, useState } from "react"

import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"
import ThemeToggle from "@/app/(app)/components/ThemeToggle"
import { isProxyTypeDisabled } from "@/shared/constants/sprint-gating"

type FooterProps = {
	locale?: SupportedLocale
}

const Footer: FC<FooterProps> = ({ locale: localeProp }) => {
	const pathname = usePathname()
	// Источник истины — URL (реактивен к смене языка), а не залипающий серверный prop.
	const currentLocale = getLocaleFromPath(pathname) ?? localeProp
	const link = (path: string) => addLocaleToPath(path, currentLocale)
	const T = (key: string) => t(key, currentLocale)

	// Появление футера при скролле к нему (а не сразу при монтировании, т.к.
	// футер ниже сгиба). IO viewport-корректен под body { zoom }.
	const ref = useRef<HTMLElement>(null)
	const [shown, setShown] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		if (typeof IntersectionObserver === "undefined") {
			setShown(true)
			return
		}
		const io = new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting) {
					setShown(true)
					io.disconnect()
				}
			},
			{ threshold: 0.12 }
		)
		io.observe(el)
		// фолбэк: если IO не сработал — показать
		const fallback = window.setTimeout(() => setShown(true), 12000)
		return () => {
			io.disconnect()
			clearTimeout(fallback)
		}
	}, [])

	return (
		<div className="ft-wrap">
			<footer ref={ref} className={`ft${shown ? " ft--in" : ""}`}>
				<div className="ft__glow" />
				{/* CTA strip */}
				<div className="ft__cta">
					<div>
						<h3>{T("footer.cta.title")}</h3>
						<p>{T("footer.cta.subtitle")}</p>
					</div>
					<div className="ft__cta-btns">
						<Link href={link("/dashboard")} className="lg-btn lg-btn--primary lg-btn--sm">
							<span className="lg-sheen" />
							<Zap className="h-[17px] w-[17px]" />
							{T("footer.cta.trial")}
						</Link>
						<Link href={link("/u-api")} className="lg-btn lg-btn--clear lg-btn--sm">
							<span className="lg-sheen" />
							<Code2 className="h-[17px] w-[17px]" />
							{T("footer.cta.apiDocs")}
						</Link>
					</div>
				</div>

				{/* main columns */}
				<div className="ft__main">
					<div className="ft__brand">
						<Link href={link("/")} className="ft__logo">
							<Image src="/logo.svg" alt={T("common.logoAlt")} width={30} height={30} className="h-[30px] w-[30px]" />
							<b>Shadow<i>Proxy</i></b>
						</Link>
						<p className="ft__tag">{T("footer.brand.tagline")}</p>
					
					</div>

					<div className="ft__col">
						<h4>{T("footer.columns.product")}</h4>
						{!isProxyTypeDisabled("RESIDENT_PREMIUM") && <Link href={link("/")}>{T("footer.product.residential")}</Link>}
						<Link href={link("/")}>{T("footer.product.ispUsa")}</Link>
						{!isProxyTypeDisabled("ISP_EU") && <Link href={link("/")}>{T("footer.product.ispEu")}</Link>}
						<Link href={link("/")}>{T("footer.product.residentialLite")}</Link>
						<Link href={link("/")}>{T("footer.product.mobile")}</Link>
						<Link href={link("/")}>{T("footer.product.premiumResidential")}</Link>
					</div>

					<div className="ft__col">
						<h4>{T("footer.columns.platform")}</h4>
						<Link href={link("/u-api")}>{T("footer.platform.api")}</Link>
						<Link href={link("/dashboard")}>{T("footer.platform.dashboard")}</Link>
						<Link href={link("/referral")}>{T("footer.platform.referral")}</Link>
					</div>

					<div className="ft__col">
						<h4>{T("footer.columns.help")}</h4>
						<Link href={link("/support")}>{T("footer.help.support")}</Link>
						<Link href={link("/terms")}>{T("footer.help.terms")}</Link>
						<Link href={link("/privacy")}>{T("footer.help.privacy")}</Link>
					</div>
				</div>

				{/* bottom bar */}
				<div className="ft__bottom">
					<span className="ft__copy">{T("footer.copyright")}</span>

					<div className="ft__legal">
						<ThemeToggle />
						<Link href={link("/terms")}>{T("footer.legal.terms")}</Link>
						<Link href={link("/privacy")}>{T("footer.legal.privacy")}</Link>
					</div>
				</div>
			</footer>
		</div>
	)
}

export default Footer
