"use client"

import { type FC, type ReactNode } from "react"

interface AuthBackgroundProps {
	children: ReactNode
	/**
	 * When true the form is rendered bare (no card chrome / max-width), because
	 * it is embedded inside the shared AuthSwitcher panel which already provides
	 * the surface. Standalone pages omit this prop and keep the card.
	 */
	embedded?: boolean
}

const AuthBackground: FC<AuthBackgroundProps> = ({ children, embedded }) => {
	if (embedded) {
		return <div className="flex w-full flex-col gap-6">{children}</div>
	}

	return (
		<div className="flex w-full flex-col items-center">
			<div className="flex w-full max-w-[440px] flex-col gap-6 rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-8 sm:p-10 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] light:border-[#e6e8ef] light:bg-none light:bg-white light:shadow-[0_40px_90px_-52px_rgba(14,16,25,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]">
				{children}
			</div>
		</div>
	)
}

export default AuthBackground
