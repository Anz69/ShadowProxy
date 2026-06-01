"use client"

import { useRouter } from "next/navigation"
import { type FC, type ReactNode, useState } from "react"
import toast from "react-hot-toast"

import { accountLinkService } from "@/features/user/services/account-link.service"
import { useTelegramLink } from "@/features/user/hooks/useTelegramLink"
import type { User } from "@/features/user/types/user.types"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

type Props = { user: User; locale: SupportedLocale }

const LinkedAccounts: FC<Props> = ({ user, locale }) => {
	const T = (key: string) => t(key, locale)
	const router = useRouter()
	const accounts = user.accounts ?? user.account ?? []
	const google = accounts.find((a) => a.provider === "GOOGLE")
	const telegram = accounts.find((a) => a.provider === "TELEGRAM")
	const [busy, setBusy] = useState(false)

	const { startLink: startTelegramLink } = useTelegramLink(() => router.refresh())

	const localizeError = (raw: string): string => {
		if (raw === "errors.cannot_unlink_last_auth")
			return T("profile.linkedAccounts.cannotUnlinkLast")
		if (raw === "errors.account_not_found")
			return T("profile.linkedAccounts.errorGeneric")
		if (raw === "errors.account_already_linked")
			return T("profile.linkedAccounts.errorAlreadyLinked")
		return raw
	}

	const onUnlink = async (provider: "GOOGLE" | "TELEGRAM") => {
		setBusy(true)
		try {
			await accountLinkService.unlink(provider)
			toast.success(T("profile.linkedAccounts.unlinked"))
			router.refresh()
		} catch (e) {
			toast.error(localizeError((e as Error).message))
		} finally {
			setBusy(false)
		}
	}

	const canUnlink = (() => {
		const hasPassword = user.authMethod === "CREDENTIALS"
		return hasPassword || accounts.length > 1
	})()

	type CardProps = {
		title: string
		badge: string
		linked: boolean
		extraRows?: ReactNode
		onLink: () => void
		onUnlinkClick: () => void
	}
	const ProviderCard: FC<CardProps> = ({
		title,
		badge,
		linked,
		extraRows,
		onLink,
		onUnlinkClick
	}) => (
		<div
			className="flex h-full flex-1 flex-col gap-3 rounded-xl p-6 transition-[border-color,box-shadow] duration-200 hover:border-white/20"
			style={{
				background:
					"linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)",
				border: "1px solid rgba(255,255,255,0.12)",
				boxShadow:
					"0 1px 0 rgba(255,255,255,0.06) inset, 0 14px 36px -20px rgba(0,0,0,0.5)"
			}}
		>
			<div className="flex flex-col gap-2">
				<span
					className="self-start rounded-lg px-4 py-2 text-sm leading-tight font-light tracking-tight text-white/70"
					style={{ background: "rgba(255,255,255,0.05)" }}
				>
					{badge}
				</span>
				<h4 className="text-xl leading-tight font-semibold tracking-tight text-white">
					{title}
				</h4>
			</div>
			<hr className="border-0" style={{ height: 1, background: "rgba(255,255,255,0.3)" }} />
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<span className="text-base text-white/50">
						{T("profile.linkedAccounts.statusLabel")}
					</span>
					<span
						className={`text-base font-medium ${
							linked ? "text-success" : "text-white/55"
						}`}
					>
						{linked
							? T("profile.linkedAccounts.linked")
							: T("profile.linkedAccounts.notLinked")}
					</span>
				</div>
				{extraRows}
			</div>
			<button
				type="button"
				disabled={busy || (linked && !canUnlink)}
				onClick={linked ? onUnlinkClick : onLink}
				title={
					linked && !canUnlink
						? T("profile.linkedAccounts.cannotUnlinkLast")
						: undefined
				}
				className="mt-auto w-full cursor-pointer rounded-xl bg-white px-9 py-2.5 text-xl leading-tight font-semibold tracking-tight text-[#222222] transition-all duration-200 hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
			>
				{linked
					? T("profile.linkedAccounts.unlink")
					: T("profile.linkedAccounts.link")}
			</button>
		</div>
	)

	return (
		<div className="flex w-full flex-col gap-5">
			<div className="flex flex-col gap-1.5">
				<h3 className="text-[22px] leading-tight font-semibold tracking-tight text-white">
					{T("profile.linkedAccounts.title")}
				</h3>
				<p className="text-sm leading-relaxed text-white/70">
					{T("profile.linkedAccounts.description")}
				</p>
			</div>
			<div className="flex w-full flex-col gap-4 md:flex-row">
				<ProviderCard
					title="Google"
					badge="OAuth"
					linked={!!google}
					onLink={() => accountLinkService.startGoogleLink()}
					onUnlinkClick={() => onUnlink("GOOGLE")}
				/>
				<ProviderCard
					title="Telegram"
					badge="Bot Auth"
					linked={!!telegram}
					extraRows={
						telegram && user.tgLogin ? (
							<div className="flex items-center justify-between gap-3">
								<span className="text-base text-white/50">
									{T("profile.linkedAccounts.loginLabel")}
								</span>
								<span className="text-base text-white">{user.tgLogin}</span>
							</div>
						) : undefined
					}
					onLink={() => startTelegramLink()}
					onUnlinkClick={() => onUnlink("TELEGRAM")}
				/>
			</div>
		</div>
	)
}

export default LinkedAccounts
