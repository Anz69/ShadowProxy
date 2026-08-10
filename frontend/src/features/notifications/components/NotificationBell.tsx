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
import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"
import ReviewModal from "@/features/reviews/components/ReviewModal"
import { addLocaleToPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"
import type { SupportedLocale } from "@/shared/utils/i18n"

type Props = { locale: SupportedLocale }

const NotificationBell: FC<Props> = ({ locale }) => {
	const [open, setOpen] = useState(false)
	const wrapRef = useRef<HTMLDivElement>(null)
	const router = useRouter()
	const { open: openModal } = useModalStore()
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
		// Просьба оставить отзыв — открываем модалку прямо здесь, без перехода
		// на /dashboard (не важно, на какой странице сейчас находимся).
		if (n.type === "review_request") {
			openModal(<ReviewModal />)
			setOpen(false)
			return
		}
		if (n.link) {
			// Внешние ссылки (рассылки) открываем в новой вкладке как есть;
			// внутренние пути — через роутер с локалью.
			if (/^https?:\/\//i.test(n.link)) {
				window.open(n.link, "_blank", "noopener,noreferrer")
			} else {
				router.push(addLocaleToPath(n.link, locale))
			}
			setOpen(false)
		}
	}

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				aria-label={T("notifications.title")}
				onClick={() => setOpen((v) => !v)}
				className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-gradient-to-b from-white/[0.12] to-white/[0.04] text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-white/25 hover:from-white/[0.18] hover:to-white/[0.07] light:border-[#e2e4ea] light:from-white light:to-white light:text-[#475467] light:hover:border-[#2f6bff]/40 light:hover:text-[#2f6bff]"
			>
				<Bell className="text-white light:text-[#475467] h-5 w-5" />
				{unread > 0 && (
					<span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0067FF] text-white text-[11px] font-semibold flex items-center justify-center">
						{unread > 9 ? "9+" : unread}
					</span>
				)}
			</button>

			{open && (
				<div
					className="notif-pop absolute right-0 mt-2 w-[340px] max-h-[420px] overflow-y-auto rounded-2xl border border-white/15 bg-[#0b0f1aee] backdrop-blur-xl shadow-2xl z-50 light:border-[#e6e8ef] light:bg-white/95"
					style={{ WebkitBackdropFilter: "blur(20px)" }}
				>
					<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 light:border-[#eef0f4]">
						<span className="text-white font-semibold light:text-[#0e1019]">{T("notifications.title")}</span>
						{hasUnread && (
							<button
								type="button"
								onClick={() => markAllRead()}
								disabled={isMarkingAll}
								className="text-[#4d8bff] hover:text-white light:text-[#2f6bff] light:hover:text-[#1d4ed8] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{T("notifications.readAll")}
							</button>
						)}
					</div>
					{items.length === 0 ? (
						<div className="px-4 py-8 text-center text-white/50 text-sm light:text-[#8a93a3]">
							{T("notifications.empty")}
						</div>
					) : (
						<ul className="divide-y divide-white/8 light:divide-[#eef0f4]">
							{items.map((n) => (
								<li key={n.id}>
									<button
										type="button"
										onClick={() => onItem(n)}
										className={`w-full text-left px-4 py-3 hover:bg-white/5 light:hover:bg-[#f4f6fa] transition-colors ${
											n.readAt ? "opacity-60" : ""
										}`}
									>
										<div className="flex items-start gap-2">
											{!n.readAt && (
												<span className="mt-1.5 w-2 h-2 rounded-full bg-[#0067FF] flex-shrink-0" />
											)}
											<div className="min-w-0">
												<p className="text-white text-sm font-medium light:text-[#0e1019]">{locField(n, "title")}</p>
												<p className="text-white/60 text-xs mt-0.5 light:text-[#5b6472]">{locField(n, "body")}</p>
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
