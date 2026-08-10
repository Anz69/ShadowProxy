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
import Input from "@/shared/components/ui/Input"
import Loader from "@/shared/components/ui/Loader/Loader"
import TelegramLoginWidget from "./TelegramLoginWidget"

const siteKey = process.env.NEXT_PUBLIC_SITE_KEY ?? ""

interface RegisterFormProps {
	/** When set, the form is rendered inside the shared AuthSwitcher panel. */
	embedded?: boolean
	/** Switches to login mode in place (used by the unified panel). */
	onSwitchMode?: () => void
}

const RegisterForm: FC<RegisterFormProps> = ({ embedded, onSwitchMode }) => {
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
		<AuthBackground embedded={embedded}>
			<div className="flex flex-col gap-1.5">
				<h2 className="font-[TalosDisplay] text-[clamp(26px,3vw,34px)] font-semibold tracking-[-0.03em] text-white light:text-[#0e1019]">{T("auth.register.title")}</h2>
			</div>
			<div className="flex flex-col gap-3">
				<TelegramLoginWidget
					botName={process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || ""}
					requestAccess={true}
					buttonText={T("auth.register.telegram")}
				/>
				<button
					type="button"
					className="inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] text-[15px] font-medium text-white transition hover:border-white/20 hover:bg-white/[0.07] light:border-[#e2e4ea] light:bg-[#f7f8fb] light:text-[#0e1019] light:hover:border-[#d8dde6] light:hover:bg-[#eef1f6]"
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
						width={20}
						height={20}
					/>
					<span>{T("auth.register.google")}</span>
				</button>
			</div>
			<div className="flex items-center gap-4">
				<div className="h-px flex-1 bg-white/[0.08] light:bg-black/[0.08]"></div>
				<span className="text-[13px] text-white/40 light:text-[#8a93a3]">{T("auth.register.or")}</span>
				<div className="h-px flex-1 bg-white/[0.08] light:bg-black/[0.08]"></div>
			</div>
			<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
				<div className="flex flex-col gap-3">
					<Input
						placeholder={T("auth.register.email")}
						type="email"
						aria-label="email"
						disabled={isLoading}
						error={errors.email?.message ? T(errors.email.message) : undefined}
						{...register("email")}
						tabIndex={1}
						className="!h-[52px] !rounded-[14px] !border !border-white/10 !bg-white/[0.04] !px-4 !text-[15px] !font-normal !text-white placeholder:text-white/35 transition focus:!border-[#4f8dff]/60 focus:!bg-white/[0.06] focus:!ring-4 focus:!ring-[#4f8dff]/15 light:!border-[#e2e4ea] light:!bg-white light:!text-[#0e1019] light:placeholder:text-[#9aa3b2] light:focus:!bg-white"
					/>
					<Input
						placeholder={T("auth.register.password")}
						type="password"
						aria-label="password"
						disabled={isLoading}
						error={errors.password?.message ? T(errors.password.message) : undefined}
						{...register("password")}
						tabIndex={2}
						className="!h-[52px] !rounded-[14px] !border !border-white/10 !bg-white/[0.04] !px-4 !text-[15px] !font-normal !text-white placeholder:text-white/35 transition focus:!border-[#4f8dff]/60 focus:!bg-white/[0.06] focus:!ring-4 focus:!ring-[#4f8dff]/15 light:!border-[#e2e4ea] light:!bg-white light:!text-[#0e1019] light:placeholder:text-[#9aa3b2] light:focus:!bg-white"
					/>
					<Input
						placeholder={T("auth.register.passwordRepeat")}
						type="password"
						aria-label="passwordRepeat"
						disabled={isLoading}
						error={errors.passwordRepeat?.message ? T(errors.passwordRepeat.message) : undefined}
						{...register("passwordRepeat")}
						tabIndex={3}
						className="!h-[52px] !rounded-[14px] !border !border-white/10 !bg-white/[0.04] !px-4 !text-[15px] !font-normal !text-white placeholder:text-white/35 transition focus:!border-[#4f8dff]/60 focus:!bg-white/[0.06] focus:!ring-4 focus:!ring-[#4f8dff]/15 light:!border-[#e2e4ea] light:!bg-white light:!text-[#0e1019] light:placeholder:text-[#9aa3b2] light:focus:!bg-white"
					/>
				</div>
				<div>
					<label className="group flex cursor-pointer items-start gap-3">
						<input
							type="checkbox"
							checked={isTermsAccepted}
							onChange={(e) => setIsTermsAccepted(e.target.checked)}
							className="peer sr-only"
						/>
						<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-white/15 bg-white/[0.04] text-transparent transition peer-checked:border-[#4f8dff] peer-checked:bg-[#2f6bff] peer-checked:text-white light:border-[#cfd5df] light:bg-[#f4f6fa]">
							<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
						</div>
						<span className="text-[13px] leading-snug text-white/55 light:text-[#5b6472]">
							<span>{T("auth.register.termsPrefix")}</span>{" "}
							<Link href="/terms" className="text-[#6aa5ff] transition-colors hover:text-[#8fb6ff] light:text-[#2f6bff] light:hover:text-[#1d4ed8]">{T("auth.register.termsLink")}</Link>
						</span>
					</label>
				</div>
				{errors.root?.message && (
					<div className="text-[14px] text-[#ff6b6b]">{T(errors.root.message)}</div>
				)}
				<button
					type="submit"
					disabled={isLoading || isTelegramProcessing || !isTermsAccepted || (Boolean(siteKey.trim()) && (!mounted || !recaptchaValue))}
					className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-[15px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
				>
					{isLoading || isTelegramProcessing ? (
						<Loader size={24} color="#EDF6F9" weight={3} />
					) : (
						T("auth.register.submit")
					)}
				</button>
				{mounted && siteKey.trim() !== "" && (
					<div className="flex justify-center">
						<ReCAPTCHA
							sitekey={siteKey}
							onChange={setRecaptchaValue}
							theme="dark"
						/>
					</div>
				)}
				<div className="text-center text-[14px] text-white/55 light:text-[#5b6472]">
					<span>{T("auth.register.hasAccount")} </span>
					{onSwitchMode ? (
						<button
							type="button"
							onClick={onSwitchMode}
							className="font-medium text-[#6aa5ff] transition-colors hover:text-[#8fb6ff] light:text-[#2f6bff] light:hover:text-[#1d4ed8]"
						>
							{T("auth.register.login")}
						</button>
					) : (
						<Link href={loginLink} className="font-medium text-[#6aa5ff] transition-colors hover:text-[#8fb6ff] light:text-[#2f6bff] light:hover:text-[#1d4ed8]">
							{T("auth.register.login")}
						</Link>
					)}
				</div>
			</form>
		</AuthBackground>
	)
}

export default RegisterForm