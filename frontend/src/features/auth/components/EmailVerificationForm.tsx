"use client"

import Link from "next/link"
import { useSearchParams, usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { useEmailVerification } from "@/features/auth/hooks/useEmailVerification"

import AuthBackground from "./AuthBackground"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const EmailVerificationForm = () => {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const searchParams = useSearchParams()
	const tokenFromUrl = searchParams.get("token")?.trim() || null
	const [manualToken, setManualToken] = useState("")
	const [isVerifying, setIsVerifying] = useState(!!tokenFromUrl)
	const { verify, isPending } = useEmailVerification()
	const loginLink = addLocaleToPath("/auth/login", currentLocale)

	useEffect(() => {
		if (tokenFromUrl) {
			verify(tokenFromUrl)
		} else {
			setIsVerifying(false)
		}
	}, [tokenFromUrl])

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		const token = manualToken.trim()
		if (!token) return
		setIsVerifying(true)
		verify(token)
	}

	return (
		<AuthBackground>
			{isVerifying || isPending ? (
				<>
					<h2 className="font-[TalosDisplay] text-[clamp(26px,3vw,34px)] font-semibold tracking-[-0.03em] text-white light:text-[#0e1019]">{T("auth.emailVerification.title")}</h2>
					<div className="flex flex-col items-center gap-4 py-4">
						<Loader size={40} weight={4} />
						<p className="text-center text-[15px] text-white/55 light:text-[#5b6472]">{T("auth.emailVerification.message")}</p>
					</div>
				</>
			) : (
				<>
					<h2 className="font-[TalosDisplay] text-[clamp(26px,3vw,34px)] font-semibold tracking-[-0.03em] text-white light:text-[#0e1019]">{T("auth.emailVerification.enterTokenTitle")}</h2>
					<p className="-mt-3 text-[15px] text-white/55 light:text-[#5b6472]">{T("auth.emailVerification.noTokenMessage")}</p>
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-3">
							<Input
								value={manualToken}
								onChange={(e) => setManualToken(e.target.value)}
								placeholder={T("auth.emailVerification.enterTokenPlaceholder")}
								className="!h-[52px] !rounded-[14px] !border !border-white/10 !bg-white/[0.04] !px-4 !text-[15px] !font-normal uppercase !text-white placeholder:text-white/35 transition focus:!border-[#4f8dff]/60 focus:!bg-white/[0.06] focus:!ring-4 focus:!ring-[#4f8dff]/15 light:!border-[#e2e4ea] light:!bg-white light:!text-[#0e1019] light:placeholder:text-[#9aa3b2] light:focus:!bg-white"
								autoComplete="one-time-code"
							/>
						</div>
						<button
							type="submit"
							disabled={!manualToken.trim() || isPending}
							className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-[15px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
						>
							{isPending ? <Loader size={24} color="#EDF6F9" weight={3} /> : T("auth.emailVerification.submit")}
						</button>
					</form>
				</>
			)}
			<div className="text-center text-[14px]">
				<Link href={loginLink} className="font-medium text-[#6aa5ff] transition-colors hover:text-[#8fb6ff] light:text-[#2f6bff] light:hover:text-[#1d4ed8]">
					{T("auth.resetPassword.backToLogin")}
				</Link>
			</div>
		</AuthBackground>
	)
}

export default EmailVerificationForm
