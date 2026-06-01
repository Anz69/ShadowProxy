"use client"

import { Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FC, useEffect, useRef, useState } from "react"

import {
	useNotifications,
	useUnreadCount,
	useMarkNotificationRead,
	useMarkAllNotificationsRead
} from "@/features/notifications/hooks/useNotifications"
import type { AppNotification } from "@/features/notifications/services/notification.service"
import { addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

type Props = { locale: SupportedLocale }

const NotificationBell: FC<Props> = ({ locale }) => {
	const [open, setOpen] = useState(false)
	const wrapRef = useRef<HTMLDivElement>(null)
	const router = useRouter()
	const T = (key: string) => t(key, locale)

	// Уведомления создаются на бэке с захардкоженным RU-текстом.
	// Локализуем по type на фронте, с фолбэком на сохранённый текст.
	const locField = (n: AppNotification, field: "title" | "body") => {
		const key = `notifications.items.${n.type}.${field}`
		const translated = T(key)
		return translated === key ? n[field] : translated
	}

	const { data: unread = 0 } = useUnreadCount(true)
	const { data: items = [] } = useNotifications(open)
	const { mutate: markRead } = useMarkNotificationRead()
	const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead()
	const hasUnread = items.some((n) => !n.readAt)

	useEffect(() => {
		const onClick = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener("mousedown", onClick)
		return () => document.removeEventListener("mousedown", onClick)
	}, [])

	const onItem = (n: AppNotification) => {
		if (!n.readAt) markRead(n.id)
		if (n.link) {
			router.push(addLocaleToPath(n.link, locale))
			setOpen(false)
		}
	}

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				aria-label={T("notifications.title")}
				onClick={() => setOpen((v) => !v)}
				className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition-all duration-200 hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.1]"
			>
				<Bell className="text-white h-5 w-5" />
				{unread > 0 && (
					<span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0067FF] text-white text-[11px] font-semibold flex items-center justify-center">
						{unread > 9 ? "9+" : unread}
					</span>
				)}
			</button>

			{open && (
				<div
					className="notif-pop absolute right-0 mt-2 w-[340px] max-h-[420px] overflow-y-auto rounded-2xl border border-white/15 bg-[#0b0f1aee] backdrop-blur-xl shadow-2xl z-50"
					style={{ WebkitBackdropFilter: "blur(20px)" }}
				>
					<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
						<span className="text-white font-semibold">{T("notifications.title")}</span>
						{hasUnread && (
							<button
								type="button"
								onClick={() => markAllRead()}
								disabled={isMarkingAll}
								className="text-[#4d8bff] hover:text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{T("notifications.readAll")}
							</button>
						)}
					</div>
					{items.length === 0 ? (
						<div className="px-4 py-8 text-center text-white/50 text-sm">
							{T("notifications.empty")}
						</div>
					) : (
						<ul className="divide-y divide-white/8">
							{items.map((n) => (
								<li key={n.id}>
									<button
										type="button"
										onClick={() => onItem(n)}
										className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors ${
											n.readAt ? "opacity-60" : ""
										}`}
									>
										<div className="flex items-start gap-2">
											{!n.readAt && (
												<span className="mt-1.5 w-2 h-2 rounded-full bg-[#0067FF] flex-shrink-0" />
											)}
											<div className="min-w-0">
												<p className="text-white text-sm font-medium">{locField(n, "title")}</p>
												<p className="text-white/60 text-xs mt-0.5">{locField(n, "body")}</p>
											</div>
										</div>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	)
}

export default NotificationBell
