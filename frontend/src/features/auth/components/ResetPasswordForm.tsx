"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { type FC, useEffect, useState } from "react"
import ReCAPTCHA from "react-google-recaptcha"
import { useForm } from "react-hook-form"

import { useRequestPasswordReset } from "@/features/auth/hooks/useRequestPasswordReset"
import { useResetPassword } from "@/features/auth/hooks/useResetPassword"
import {
	type RequestPasswordResetDto,
	type ResetPasswordDto,
	requestPasswordResetSchema,
	resetPasswordSchema
} from "@/features/auth/schemas/password-recovery.schema"

import AuthBackground from "@/features/auth/components/AuthBackground"
import Button from "@/shared/components/ui/Button"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const siteKey = process.env.NEXT_PUBLIC_SITE_KEY ?? ""

const ResetPasswordForm: FC = () => {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const [recaptchaValue, setRecaptchaValue] = useState<string | null>(null)
	const [isEmailSent, setIsEmailSent] = useState(false)
	const [mounted, setMounted] = useState(false)
	const searchParams = useSearchParams()
	const router = useRouter()

	useEffect(() => {
		setMounted(true)
	}, [])

	const token = searchParams.get("token")

	const {
		handleSubmit: handleRequestSubmit,
		register: registerRequest,
		formState: { errors: requestErrors },
		setError: setRequestError
	} = useForm<RequestPasswordResetDto>({
		resolver: zodResolver(requestPasswordResetSchema),
		defaultValues: {
			email: ""
		}
	})

	const {
		handleSubmit: handleResetSubmit,
		register: registerReset,
		formState: { errors: resetErrors },
		setError: setResetError
	} = useForm<ResetPasswordDto>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			password: "",
			passwordRepeat: ""
		}
	})

	const { resetPassword: requestPasswordReset, isLoading: isRequestLoading } = useRequestPasswordReset()
	const { resetPassword, isLoading: isResetLoading } = useResetPassword()

	const onRequestSubmit = (dto: RequestPasswordResetDto) => {
		console.log("ResetPasswordForm onRequestSubmit:", dto)
		const needsCaptcha = Boolean(siteKey.trim())
		if (needsCaptcha && !recaptchaValue) {
			setRequestError("root", {
				message: T("auth.resetPassword.captchaFailed")
			})
			return
		}
		requestPasswordReset(
			{
				dto,
				recaptcha: recaptchaValue ?? undefined
			},
			{
				onSuccess: async (data) => {
					console.log("ResetPasswordForm onSuccess:", data)
					setIsEmailSent(true)
				},
				onError: e => {
					console.log("ResetPasswordForm onError:", e)
					setRequestError("root", {
						message: e.message
					})
				}
			}
		)
	}

	const onResetSubmit = (dto: ResetPasswordDto) => {
		console.log("ResetPasswordForm onResetSubmit:", dto)
		if (token) {
			resetPassword(
				{
					...dto,
					token
				},
				{
					onSuccess: async (data) => {
						console.log("ResetPasswordForm onResetSuccess:", data)
						const localizedPath = getLocalizedPath(pathname, "/auth/login")
						await router.push(localizedPath)
					},
					onError: e => {
						console.log("ResetPasswordForm onResetError:", e)
						setResetError("root", {
							message: e.message
						})
					}
				}
			)
		} else {
			setResetError("root", {
				message: T("auth.resetPassword.tokenMissing")
			})
		}
	}

	useEffect(() => {
		if (token) {
			setIsEmailSent(true)
		}
	}, [token])

	const loginLink = addLocaleToPath("/auth/login", currentLocale)

	return (
		<AuthBackground>
			{!token ? (
				<>
					<h2 className="login-form-title">{T("auth.resetPassword.title")}</h2>
					{isEmailSent ? (
						<div className="login-success-message">
							<p>{T("auth.resetPassword.emailSentTitle")}</p>
							<p>{T("auth.resetPassword.emailSentMessage")}</p>
						</div>
					) : (
						<form onSubmit={handleRequestSubmit(onRequestSubmit)} className="login-form">
							<div className="login-inputs-group">
								<Input
									placeholder={T("auth.resetPassword.email")}
									type="email"
									aria-label="email"
									disabled={isRequestLoading}
								error={requestErrors.email?.message ? T(requestErrors.email.message) : undefined}
								{...registerRequest("email")}
									tabIndex={1}
									className="login-input"
								/>
							</div>
							{requestErrors.root?.message && (
								<div className="login-error">{T(requestErrors.root.message)}</div>
							)}
							<Button variant="fill" type="submit" disabled={isRequestLoading || (Boolean(siteKey.trim()) && (!mounted || !recaptchaValue))} className="login-submit-button">
								{isRequestLoading ? (
									<Loader size={24} color="#EDF6F9" weight={3} />
								) : (
									T("auth.resetPassword.submit")
								)}
							</Button>
							{mounted && siteKey.trim() !== "" && (
								<ReCAPTCHA
									sitekey={siteKey}
									onChange={setRecaptchaValue}
									theme="dark"
									className="login-recaptcha"
								/>
							)}
						</form>
					)}
				</>
			) : (
				<>
					<h2 className="login-form-title">{T("auth.resetPassword.newPasswordTitle")}</h2>
					<form onSubmit={handleResetSubmit(onResetSubmit)} className="login-form">
						<div className="login-inputs-group">
							<Input
								placeholder={T("auth.resetPassword.newPassword")}
								type="password"
								aria-label="password"
								disabled={isResetLoading}
								error={resetErrors.password?.message ? T(resetErrors.password.message) : undefined}
								{...registerReset("password")}
								tabIndex={1}
								className="login-input"
							/>
							<Input
								placeholder={T("auth.resetPassword.passwordRepeat")}
								type="password"
								aria-label="passwordRepeat"
								disabled={isResetLoading}
								error={resetErrors.passwordRepeat?.message ? T(resetErrors.passwordRepeat.message) : undefined}
								{...registerReset("passwordRepeat")}
								tabIndex={2}
								className="login-input"
							/>
						</div>
						{resetErrors.root?.message && (
							<div className="login-error">{T(resetErrors.root.message)}</div>
						)}
						<Button variant="fill" type="submit" disabled={isResetLoading} className="login-submit-button">
							{isResetLoading ? (
								<Loader size={24} color="#EDF6F9" weight={3} />
							) : (
								T("auth.resetPassword.savePassword")
							)}
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

export default ResetPasswordForm