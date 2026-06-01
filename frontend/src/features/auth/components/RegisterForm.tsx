"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { type FC, useEffect, useState } from "react"
import ReCAPTCHA from "react-google-recaptcha"
import { useForm } from "react-hook-form"

import { useRegister } from "@/features/auth/hooks/useRegister"
import { useTelegramAuth } from "@/features/auth/hooks/useTelegramAuth"
import {
	type RegisterDto,
	registerSchema
} from "@/features/auth/schemas/register.schema"
import { getCookie } from "@/shared/utils/getCookie"
import { getLocalizedPath } from "@/shared/utils/getLocalizedPath"
import { getLocaleFromPath, addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

import AuthBackground from "@/features/auth/components/AuthBackground"
import Button from "@/shared/components/ui/Button"
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import TelegramLoginWidget from "./TelegramLoginWidget"

const siteKey = process.env.NEXT_PUBLIC_SITE_KEY ?? ""

const RegisterForm: FC = () => {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)
	const [recaptchaValue, setRecaptchaValue] = useState<string | null>(null)
	const [isTermsAccepted, setIsTermsAccepted] = useState(false)
	const [mounted, setMounted] = useState(false)
	const router = useRouter()
	const { isProcessing: isTelegramProcessing } = useTelegramAuth()

	useEffect(() => {
		setMounted(true)
	}, [])

	const {
		handleSubmit,
		register,
		formState: { errors },
		setError
	} = useForm<RegisterDto>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			email: "",
			password: "",
			passwordRepeat: ""
		}
	})

	const { registerUser, isLoading } = useRegister()

	const onSubmit = (dto: RegisterDto) => {
		console.log("RegisterForm onSubmit:", dto)
		if (!isTermsAccepted) {
			setError("root", {
				message: T("auth.register.termsRequired")
			})
			return
		}
		const needsCaptcha = Boolean(siteKey.trim())
		if (needsCaptcha && !recaptchaValue) {
			setError("root", {
				message: T("auth.register.captchaFailed")
			})
			return
		}
		const referrerId = getCookie("referrer")
		registerUser(
			{
				dto: {
					...dto,
					referrerId: referrerId || undefined
				},
				recaptcha: recaptchaValue ?? undefined
			},
			{
				onSuccess: async (data) => {
					console.log("RegisterForm onSuccess:", data)
					const localizedPath = getLocalizedPath(pathname, "/auth/email-verification")
					await router.push(localizedPath)
				},
				onError: e => {
					console.log("RegisterForm onError:", e)
					setError("root", {
						message: e.message
					})
				}
			}
		)
	}

	const loginLink = addLocaleToPath("/auth/login", currentLocale)

	return (
		<AuthBackground>
			<h2 className="login-form-title">{T("auth.register.title")}</h2>
			<div className="login-buttons-group">
				<TelegramLoginWidget
					botName={process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || ""}
					requestAccess={true}
					buttonText={T("auth.register.telegram")}
				/>
				<button
					type="button"
					className="login-button login-button-google"
					onClick={() => {
						const referrerId = getCookie("referrer")
						const url = new URL(`${process.env.NEXT_PUBLIC_BACKEND_URI}/auth/oauth/connect/google`)
						if (referrerId) {
							url.searchParams.set("referrer", referrerId)
						}
						window.location.replace(url.toString())
					}}
				>
					<img
						src="/google-logo.svg"
						alt=""
						width={24}
						height={24}
					/>
					<span>{T("auth.register.google")}</span>
				</button>
			</div>
			<div className="login-divider">
				<div className="login-divider-line"></div>
				<span className="login-divider-text">{T("auth.register.or")}</span>
				<div className="login-divider-line"></div>
			</div>
			<form onSubmit={handleSubmit(onSubmit)} className="login-form">
				<div className="login-inputs-group">
					<Input
						placeholder={T("auth.register.email")}
						type="email"
						aria-label="email"
						disabled={isLoading}
						error={errors.email?.message ? T(errors.email.message) : undefined}
						{...register("email")}
						tabIndex={1}
						className="login-input"
					/>
					<Input
						placeholder={T("auth.register.password")}
						type="password"
						aria-label="password"
						disabled={isLoading}
						error={errors.password?.message ? T(errors.password.message) : undefined}
						{...register("password")}
						tabIndex={2}
						className="login-input"
					/>
					<Input
						placeholder={T("auth.register.passwordRepeat")}
						type="password"
						aria-label="passwordRepeat"
						disabled={isLoading}
						error={errors.passwordRepeat?.message ? T(errors.passwordRepeat.message) : undefined}
						{...register("passwordRepeat")}
						tabIndex={3}
						className="login-input"
					/>
				</div>
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
							<span className="terms-text">{T("auth.register.termsPrefix")}</span>
							<Link href="/terms" className="terms-link">{T("auth.register.termsLink")}</Link>
						</span>
					</label>
				</div>
				{errors.root?.message && (
					<div className="login-error">{T(errors.root.message)}</div>
				)}
				<Button variant="fill" type="submit" disabled={isLoading || isTelegramProcessing || !isTermsAccepted || (Boolean(siteKey.trim()) && (!mounted || !recaptchaValue))} className="login-submit-button">
					{isLoading || isTelegramProcessing ? (
						<Loader size={24} color="#EDF6F9" weight={3} />
					) : (
						T("auth.register.submit")
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
				<div className="login-register-link">
					<span>{T("auth.register.hasAccount")} </span>
					<Link href={loginLink} className="login-register-link-text">
						{T("auth.register.login")}
					</Link>
				</div>
			</form>
		</AuthBackground>
	)
}

export default RegisterForm