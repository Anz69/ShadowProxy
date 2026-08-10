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
					<h2 className="font-[TalosDisplay] text-[clamp(26px,3vw,34px)] font-semibold tracking-[-0.03em] text-white light:text-[#0e1019]">{T("auth.resetPassword.title")}</h2>
					{isEmailSent ? (
						<div className="flex flex-col gap-2 rounded-[14px] border border-[#4f8dff]/20 bg-[#4f8dff]/[0.07] p-4 text-[15px] text-white/75 light:border-[#2f6bff]/20 light:bg-[#2f6bff]/[0.06] light:text-[#475467]">
							<p className="font-medium text-white light:text-[#0e1019]">{T("auth.resetPassword.emailSentTitle")}</p>
							<p>{T("auth.resetPassword.emailSentMessage")}</p>
						</div>
					) : (
						<form onSubmit={handleRequestSubmit(onRequestSubmit)} className="flex flex-col gap-4">
							<div className="flex flex-col gap-3">
								<Input
									placeholder={T("auth.resetPassword.email")}
									type="email"
									aria-label="email"
									disabled={isRequestLoading}
								error={requestErrors.email?.message ? T(requestErrors.email.message) : undefined}
								{...registerRequest("email")}
									tabIndex={1}
									className="!h-[52px] !rounded-[14px] !border !border-white/10 !bg-white/[0.04] !px-4 !text-[15px] !font-normal !text-white placeholder:text-white/35 transition focus:!border-[#4f8dff]/60 focus:!bg-white/[0.06] focus:!ring-4 focus:!ring-[#4f8dff]/15 light:!border-[#e2e4ea] light:!bg-white light:!text-[#0e1019] light:placeholder:text-[#9aa3b2] light:focus:!bg-white"
								/>
							</div>
							{requestErrors.root?.message && (
								<div className="text-[14px] text-[#ff6b6b]">{T(requestErrors.root.message)}</div>
							)}
							<button
								type="submit"
								disabled={isRequestLoading || (Boolean(siteKey.trim()) && (!mounted || !recaptchaValue))}
								className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-[15px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
							>
								{isRequestLoading ? (
									<Loader size={24} color="#EDF6F9" weight={3} />
								) : (
									T("auth.resetPassword.submit")
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
						</form>
					)}
				</>
			) : (
				<>
					<h2 className="font-[TalosDisplay] text-[clamp(26px,3vw,34px)] font-semibold tracking-[-0.03em] text-white light:text-[#0e1019]">{T("auth.resetPassword.newPasswordTitle")}</h2>
					<form onSubmit={handleResetSubmit(onResetSubmit)} className="flex flex-col gap-4">
						<div className="flex flex-col gap-3">
							<Input
								placeholder={T("auth.resetPassword.newPassword")}
								type="password"
								aria-label="password"
								disabled={isResetLoading}
								error={resetErrors.password?.message ? T(resetErrors.password.message) : undefined}
								{...registerReset("password")}
								tabIndex={1}
								className="!h-[52px] !rounded-[14px] !border !border-white/10 !bg-white/[0.04] !px-4 !text-[15px] !font-normal !text-white placeholder:text-white/35 transition focus:!border-[#4f8dff]/60 focus:!bg-white/[0.06] focus:!ring-4 focus:!ring-[#4f8dff]/15 light:!border-[#e2e4ea] light:!bg-white light:!text-[#0e1019] light:placeholder:text-[#9aa3b2] light:focus:!bg-white"
							/>
							<Input
								placeholder={T("auth.resetPassword.passwordRepeat")}
								type="password"
								aria-label="passwordRepeat"
								disabled={isResetLoading}
								error={resetErrors.passwordRepeat?.message ? T(resetErrors.passwordRepeat.message) : undefined}
								{...registerReset("passwordRepeat")}
								tabIndex={2}
								className="!h-[52px] !rounded-[14px] !border !border-white/10 !bg-white/[0.04] !px-4 !text-[15px] !font-normal !text-white placeholder:text-white/35 transition focus:!border-[#4f8dff]/60 focus:!bg-white/[0.06] focus:!ring-4 focus:!ring-[#4f8dff]/15 light:!border-[#e2e4ea] light:!bg-white light:!text-[#0e1019] light:placeholder:text-[#9aa3b2] light:focus:!bg-white"
							/>
						</div>
						{resetErrors.root?.message && (
							<div className="text-[14px] text-[#ff6b6b]">{T(resetErrors.root.message)}</div>
						)}
						<button
							type="submit"
							disabled={isResetLoading}
							className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#4f8dff] to-[#2f6bff] text-[15px] font-semibold text-white shadow-[0_14px_40px_-12px_rgba(59,130,246,0.8)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
						>
							{isResetLoading ? (
								<Loader size={24} color="#EDF6F9" weight={3} />
							) : (
								T("auth.resetPassword.savePassword")
							)}
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

export default ResetPasswordForm