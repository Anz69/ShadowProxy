"use client"

import Link from "next/link"
import { useSearchParams, usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { useEmailVerification } from "@/features/auth/hooks/useEmailVerification"

import AuthBackground from "./AuthBackground"
import Button from "@/shared/components/ui/Button"
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
					<h2 className="login-form-title">{T("auth.emailVerification.title")}</h2>
					<div className="login-form login-form--centered">
						<Loader size={40} weight={4} />
						<p className="login-verification-message">{T("auth.emailVerification.message")}</p>
					</div>
				</>
			) : (
				<>
					<h2 className="login-form-title">{T("auth.emailVerification.enterTokenTitle")}</h2>
					<p className="login-verification-hint">{T("auth.emailVerification.noTokenMessage")}</p>
					<form onSubmit={handleSubmit} className="login-form">
						<div className="login-inputs-group login-inputs-group--single">
							<Input
								value={manualToken}
								onChange={(e) => setManualToken(e.target.value)}
								placeholder={T("auth.emailVerification.enterTokenPlaceholder")}
								className="login-input uppercase"
								autoComplete="one-time-code"
							/>
						</div>
						<Button variant="fill" type="submit" disabled={!manualToken.trim() || isPending} className="login-submit-button">
							{isPending ? <Loader size={24} color="#EDF6F9" weight={3} /> : T("auth.emailVerification.submit")}
						</Button>
					</form>
				</>
			)}
			<div className="login-register-link">
				<Link href={loginLink} className="login-register-link-text">
					{T("auth.resetPassword.backToLogin")}
				</Link>
			</div>
		</AuthBackground>
	)
}

export default EmailVerificationForm
