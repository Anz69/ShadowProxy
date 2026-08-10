import type { ReactNode } from "react"

import { getUser } from "@/shared/server/getUser"
import { getLocale } from "@/shared/server/getLocale"
import Footer from "@/shared/components/widgets/Footer"
import Header from "@/shared/components/widgets/Header/Header"

/**
 * Persistent chrome for auth pages (login/register/reset). Kept separate from
 * the (app) group so the auth flow can have its own shell; Header/Footer stay
 * mounted across auth navigations (login ↔ register) instead of remounting.
 */
export default async function AuthLayout({
	children
}: {
	children: ReactNode
}) {
	const user = await getUser()
	const locale = await getLocale()

	return (
		<div className="layout-root flex w-full flex-col bg-[#060d1e] font-[TalosInter] text-white light:bg-[#eceff5] light:text-[#0e1019]">
			<div className="max-md:static md:sticky md:top-0 z-[100] pt-[32px]">
				<Header user={user} locale={locale} />
			</div>
			<div className="relative flex flex-1 w-full flex-col items-center justify-center layout-content px-4 pt-10 pb-16 sm:pt-16">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 -z-[1] h-[760px] bg-[radial-gradient(48%_55%_at_50%_-6%,rgba(79,141,255,0.20),transparent_70%)]"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 -z-[1] h-[760px] bg-[linear-gradient(rgba(130,170,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(130,170,255,0.05)_1px,transparent_1px)] [background-size:60px_60px] [mask-image:radial-gradient(70%_50%_at_50%_0%,#000,transparent_75%)]"
				/>
				{children}
			</div>
			<Footer locale={locale} />
		</div>
	)
}
