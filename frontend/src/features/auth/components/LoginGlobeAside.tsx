"use client"

import { type FC } from "react"
import { usePathname } from "next/navigation"

import ProxyGlobe from "@/shared/components/widgets/ProxyGlobe"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

/**
 * Marketing panel shown only on the login page (lg+). Renders the auto-rotating
 * ProxyGlobe with a soft radial glow and a short headline/subtext. Theme-aware
 * via `light:` utilities so it reads well in both light and dark themes.
 */
const LoginGlobeAside: FC = () => {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)

	return (
		<div className="relative flex w-full flex-col items-center gap-8 px-2 py-4">
			<span className="z-[1] inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#6aa5ff] light:border-[#2f6bff]/20 light:bg-[#2f6bff]/[0.08] light:text-[#2f6bff]">
				{T("auth.login.asideEyebrow")}
			</span>

			<div className="relative flex w-full items-center justify-center">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-[1] bg-[radial-gradient(50%_50%_at_50%_45%,rgba(79,141,255,0.22),transparent_70%)] blur-[50px] light:bg-[radial-gradient(50%_50%_at_50%_45%,rgba(47,107,255,0.14),transparent_70%)]"
				/>
				<ProxyGlobe size={560} className="max-w-full" />
			</div>

			<div className="z-[1] flex flex-col items-center gap-3 text-center">
				<h2 className="font-[TalosDisplay] text-3xl font-semibold leading-tight text-white light:text-[#0e1019]">
					{T("auth.login.asideHeadline")}
				</h2>
				<p className="text-base text-white/60 light:text-[#5b6472]">
					{T("auth.login.asideSubtext")}
				</p>
			</div>
		</div>
	)
}

export default LoginGlobeAside
