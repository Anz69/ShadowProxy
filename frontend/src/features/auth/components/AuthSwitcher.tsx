"use client"

import { usePathname, useRouter } from "next/navigation"
import { type FC, useCallback, useEffect, useState } from "react"

import LoginForm from "./LoginForm"
import LoginGlobeAside from "./LoginGlobeAside"
import RegisterForm from "./RegisterForm"
import { addLocaleToPath, getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

export type AuthMode = "login" | "register"

interface AuthSwitcherProps {
	/** Mode to render first; comes from the route so SSR is correct. */
	initialMode: AuthMode
}

/**
 * Unified auth experience shared by /auth/login and /auth/register.
 *
 * LEFT (lg+): the marketing globe aside. RIGHT: segmented Login/Register tabs
 * plus the active form. Both forms occupy the SAME CSS grid cell, so the panel
 * is always as tall as the taller form — switching is a jank-free opacity
 * crossfade with no height animation, measurement, or layout jump.
 *
 * The URL is kept in sync with `router.replace` so the current mode stays
 * shareable/back-button friendly without a full navigation (the route group
 * layout is persistent, so this does not remount the panel).
 */
const AuthSwitcher: FC<AuthSwitcherProps> = ({ initialMode }) => {
	const pathname = usePathname()
	const router = useRouter()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)

	const [mode, setMode] = useState<AuthMode>(initialMode)

	// Keep state in sync if the route changes underneath us (e.g. browser
	// back/forward between /auth/login and /auth/register).
	useEffect(() => {
		setMode(initialMode)
	}, [initialMode])

	const switchTo = useCallback(
		(next: AuthMode) => {
			if (next === mode) return
			setMode(next)
			const path = next === "login" ? "/auth/login" : "/auth/register"
			router.replace(addLocaleToPath(path, currentLocale), { scroll: false })
		},
		[mode, router, currentLocale]
	)

	const isLogin = mode === "login"

	return (
		<div className="flex w-full max-w-[1280px] flex-col items-center justify-center gap-12 lg:flex-row lg:items-stretch lg:gap-20">
			{/* LEFT: globe marketing aside — no card, sits on the page bg; hidden on mobile */}
			<div className="hidden flex-1 items-center justify-center lg:flex">
				<LoginGlobeAside />
			</div>

			{/* RIGHT: tabs + animated form — fills its column */}
			<div className="flex w-full flex-1 items-center justify-center">
				<div className="flex w-full flex-col justify-center gap-6 rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-8 sm:p-10 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] light:border-[#e6e8ef] light:bg-none light:bg-white light:shadow-[0_40px_90px_-52px_rgba(14,16,25,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]">
					{/* Segmented Login / Register tabs */}
					<div
						role="tablist"
						aria-label="Auth mode"
						className="relative grid grid-cols-2 gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 light:border-[#e6e8ef] light:bg-[#f4f6fa]"
					>
						<span
							aria-hidden
							className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] shadow-[0_8px_24px_-10px_rgba(59,130,246,0.9)] transition-transform duration-300 ease-out"
							style={{ transform: isLogin ? "translateX(0)" : "translateX(100%)" }}
						/>
						<button
							type="button"
							role="tab"
							aria-selected={isLogin}
							onClick={() => switchTo("login")}
							className={`relative z-[1] inline-flex h-10 items-center justify-center rounded-full text-[14px] font-semibold transition-colors duration-200 ${
								isLogin ? "text-white" : "text-white/55 hover:text-white/80 light:text-[#5b6472] light:hover:text-[#0e1019]"
							}`}
						>
							{T("auth.login.tabLogin")}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={!isLogin}
							onClick={() => switchTo("register")}
							className={`relative z-[1] inline-flex h-10 items-center justify-center rounded-full text-[14px] font-semibold transition-colors duration-200 ${
								!isLogin ? "text-white" : "text-white/55 hover:text-white/80 light:text-[#5b6472] light:hover:text-[#0e1019]"
							}`}
						>
							{T("auth.login.tabRegister")}
						</button>
					</div>

					{/* Both forms share one grid cell → panel height = taller form,
					    so switching is a pure crossfade with zero height jump. */}
					<div className="grid w-full">
						<div
							aria-hidden={!isLogin}
							className={`[grid-area:1/1] transition-[opacity,transform] duration-300 ease-out ${
								isLogin
									? "z-[1] translate-x-0 opacity-100"
									: "pointer-events-none -translate-x-2 opacity-0"
							}`}
						>
							<LoginForm embedded onSwitchMode={() => switchTo("register")} />
						</div>
						<div
							aria-hidden={isLogin}
							className={`[grid-area:1/1] transition-[opacity,transform] duration-300 ease-out ${
								!isLogin
									? "z-[1] translate-x-0 opacity-100"
									: "pointer-events-none translate-x-2 opacity-0"
							}`}
						>
							<RegisterForm embedded onSwitchMode={() => switchTo("login")} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default AuthSwitcher
