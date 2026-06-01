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
		<div className="layout-root flex w-full flex-col">
			<div className="max-md:static md:sticky md:top-0 z-[100] pt-[32px]">
				<Header user={user} locale={locale} />
			</div>
			<div className="flex flex-1 w-full flex-col items-center gap-4 md:gap-6 layout-content pt-[24px] pb-8">
				{children}
			</div>
			<Footer locale={locale} />
		</div>
	)
}
