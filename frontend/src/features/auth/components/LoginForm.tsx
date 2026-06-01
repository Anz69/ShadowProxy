"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { type FC, useEffect, useRef, useState } from "react"
import ReCAPTCHA from "react-google-recaptcha"
import { useForm } from "react-hook-form"

import { useLogin } from "@/features/auth/hooks/useLogin"
import { useTelegramAuth } from "@/features/auth/hooks/useTelegramAuth"
import {
	type LoginDto,
	loginSchema
} from "@/features/auth/schemas/login.schema"

import AuthBackground from "./AuthBackground"
import Button from "@/shared/components/ui/Button"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import TelegramLoginWidget from "./TelegramLoginWidget"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

const siteKey = process.env.NEXT_PUBLIC_SITE_KEY ?? ""

const LoginForm: FC = () => {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const [recaptchaValue, setRecaptchaValue] = useState<string | null>(null)
	const recaptchaRef = useRef<ReCAPTCHA>(null)
	const [isTermsAccepted, setIsTermsAccepted] = useState(false)
	const [mounted, setMounted] = useState(false)
	const searchParams = useSearchParams()
	const router = useRouter()
	const [reason, setReason] = useState<string | null>(null)
	const { isProcessing: isTelegramProcessing } = useTelegramAuth()

	useEffect(() => {
		setMounted(true)
	}, [])

	const {
		handleSubmit,
		register,
		formState: { errors },
		setError
	} = useForm<LoginDto>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: ""
		}
	})

	const { login, isLoading } = useLogin()

	const onSubmit = (dto: LoginDto) => {
		console.log("LoginForm onSubmit:", dto)
		setReason(null)
		if (!isTermsAccepted) {
			setError("root", {
				message: T("auth.login.termsRequired")
			})
			return
		}
		const needsCaptcha = Boolean(siteKey.trim())
		if (needsCaptcha && !recaptchaValue) {
			setError("root", {
				message: T("auth.login.captchaFailed")
			})
			return
		}
		login(
			{
				dto,
				recaptcha: recaptchaValue ?? undefined
			},
			{
				onSuccess: async (data) => {
					console.log("LoginForm onSuccess:", data)
					console.log("All cookies:", document.cookie)
					const localizedPath = getLocalizedPath(pathname, "/dashboard")
					await router.push(localizedPath)
				},
				onError: e => {
					console.log("LoginForm onError:", e)
					// Сбрасываем reCAPTCHA — token одноразовый, после ошибки
					// сервер ответит "no longer valid / already used" на повторный submit.
					recaptchaRef.current?.reset()
					setRecaptchaValue(null)
					setError("root", {
						message: e.message
					})
				}
			}
		)
	}

	useEffect(() => {
		if (searchParams.get("reason")) {
			setReason(searchParams.get("reason"))
		}
	}, [searchParams])

	const resetPasswordLink = addLocaleToPath("/auth/reset-password", currentLocale)
	const registerLink = addLocaleToPath("/auth/register", currentLocale)

	return (
		<AuthBackground>
			<h2 className="login-form-title">{T("auth.login.formTitle")}</h2>
			<div className="login-buttons-group">
				<TelegramLoginWidget
					botName={process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || ""}
					requestAccess={true}
					buttonText={T("auth.login.telegram")}
				/>
				<button
					type="button"
					className="login-button login-button-google"
					onClick={() => {
						window.location.replace(
							`${process.env.NEXT_PUBLIC_BACKEND_URI}/auth/oauth/connect/google`
						)
					}}
				>
					<img
						src="/google-logo.svg"
						alt=""
						width={24}
						height={24}
					/>
					<span>{T("auth.login.google")}</span>
				</button>
			</div>
			<div className="login-divider">
				<div className="login-divider-line"></div>
				<span className="login-divider-text">{T("auth.login.or")}</span>
				<div className="login-divider-line"></div>
			</div>
			<form onSubmit={handleSubmit(onSubmit)} className="login-form">
				<div className="login-inputs-group">
					<Input
						placeholder={T("auth.login.email")}
						type="email"
						aria-label="email"
						disabled={isLoading}
						error={errors.email?.message ? T(errors.email.message) : undefined}
						{...register("email")}
						tabIndex={1}
						className="login-input"
					/>
					<Input
						placeholder={T("auth.login.password")}
						type="password"
						aria-label="password"
						disabled={isLoading}
						error={errors.password?.message ? T(errors.password.message) : undefined}
						{...register("password")}
						tabIndex={2}
						className="login-input"
					/>
				</div>
				<Link href={resetPasswordLink} className="login-forgot-password">
					{T("auth.login.forgotPassword")}
				</Link>
				<div className="login-terms">
					<label className="login-checkbox-label">
						<input
							type="checkbox"
							checked={isTermsAccepted}
							onChange={(e) => setIsTermsAccepted(e.target.checked)}
							className="login-checkbox"
						/>
						<div className="login-checkbox-icon"></div>
						<span className="login-terms-text">
							<span className="terms-text">{T("auth.login.termsPrefix")}</span>
							<Link href="/terms" className="terms-link">{T("auth.login.termsLink")}</Link>
						</span>
					</label>
				</div>
				{reason && reason.length && (
					<div className="login-error">
						{T("auth.login.googleCanceled")}
					</div>
				)}
				{errors.root?.message && (
					<div className="login-error">{T(errors.root.message)}</div>
				)}
				<Button variant="fill" type="submit" disabled={isLoading || isTelegramProcessing || !isTermsAccepted || (Boolean(siteKey.trim()) && (!mounted || !recaptchaValue))} className="login-submit-button">
					{isLoading || isTelegramProcessing ? (
						<Loader size={24} color="#EDF6F9" weight={3} />
					) : (
						T("auth.login.submit")
					)}
				</Button>
				{mounted && siteKey.trim() !== "" && (
					<ReCAPTCHA
						ref={recaptchaRef}
						sitekey={siteKey}
						onChange={setRecaptchaValue}
						onExpired={() => setRecaptchaValue(null)}
						onErrored={() => setRecaptchaValue(null)}
						theme="dark"
						className="login-recaptcha"
					/>
				)}
				<div className="login-register-link">
					<span>{T("auth.login.noAccount")} </span>
					<Link href={registerLink} className="login-register-link-text">
						{T("auth.login.register")}
					</Link>
				</div>
			</form>
		</AuthBackground>
	)
}

export default LoginForm
