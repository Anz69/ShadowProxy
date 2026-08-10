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
		<div className="flex h-full flex-1 flex-col gap-3 rounded-xl border border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_36px_-20px_rgba(0,0,0,0.5)] transition-[border-color,box-shadow] duration-200 hover:border-white/20 light:border-[#e6e8ef] light:bg-white light:shadow-[0_14px_36px_-24px_rgba(14,16,25,0.16)] light:hover:border-[#d8dde6]">
			<div className="flex flex-col gap-2">
				<span className="self-start rounded-lg bg-white/[0.05] px-4 py-2 text-sm leading-tight font-light tracking-tight text-white/70 light:bg-[#f4f6fa] light:text-[#5b6472]">
					{badge}
				</span>
				<h4 className="text-xl leading-tight font-semibold tracking-tight text-white light:text-[#0e1019]">
					{title}
				</h4>
			</div>
			<hr className="h-px border-0 bg-white/20 light:bg-black/[0.08]" />
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<span className="text-base text-white/50 light:text-[#8a93a3]">
						{T("profile.linkedAccounts.statusLabel")}
					</span>
					<span
						className={`text-base font-medium ${
							linked ? "text-success" : "text-white/55 light:text-[#8a93a3]"
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
				className="mt-auto w-full cursor-pointer rounded-xl bg-white px-9 py-2.5 text-xl leading-tight font-semibold tracking-tight text-[#222222] transition-all duration-200 hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 light:bg-[#2f6bff] light:text-white light:hover:bg-[#1d4ed8]"
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
				<h3 className="text-[22px] leading-tight font-semibold tracking-tight text-white light:text-[#0e1019]">
					{T("profile.linkedAccounts.title")}
				</h3>
				<p className="text-sm leading-relaxed text-white/70 light:text-[#5b6472]">
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
								<span className="text-base text-white/50 light:text-[#8a93a3]">
									{T("profile.linkedAccounts.loginLabel")}
								</span>
								<span className="text-base text-white light:text-[#0e1019]">{user.tgLogin}</span>
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
