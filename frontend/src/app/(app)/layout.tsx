import type { ReactNode } from "react"

import { getUser } from "@/shared/server/getUser"
import { getLocale } from "@/shared/server/getLocale"
import Footer from "@/shared/components/widgets/Footer"
import PreFooterCTA from "@/shared/components/widgets/PreFooterCTA"
import Header from "@/shared/components/widgets/Header/Header"

/**
 * Persistent app shell. Lives at the route-group level so Header/Footer DO NOT
 * remount when navigating between content pages (this kills the "reload" flash).
 * Page content animates via (app)/template.tsx; the chrome here stays mounted.
 */
export default async function AppLayout({
	children
}: {
	children: ReactNode
}) {
	const user = await getUser()
	const locale = await getLocale()

	return (
		<div className="layout-root flex w-full flex-col bg-[#060d1e] text-white light:bg-[#eceff5] light:text-[#0e1019]">
			<div className="sticky top-0 z-[100] pt-[12px] md:pt-[24px]">
				<Header user={user} locale={locale} />
			</div>
			<div className="flex flex-1 w-full flex-col layout-content pt-[12px] pb-8">
				{children}
			</div>
			<PreFooterCTA locale={locale} />
			<Footer locale={locale} />
		</div>
	)
}
