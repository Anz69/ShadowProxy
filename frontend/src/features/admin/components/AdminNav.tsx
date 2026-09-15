"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import type { FC } from "react"

import { adminSupportService } from "@/features/support/services/admin-support.service"

const NAV = [
	{ href: "/admin/users", label: "Пользователи" },
	{ href: "/admin/stats", label: "Статистика" },
	{ href: "/admin/logs", label: "Логи" },
	{ href: "/admin/settings", label: "Настройки" },
	{ href: "/admin/keys", label: "Ключи" },
	{ href: "/admin/servers", label: "Серверы" },
	{ href: "/admin/reviews", label: "Отзывы" },
	{ href: "/admin/support", label: "Поддержка" },
	{ href: "/admin/broadcasts", label: "Рассылки" },
	{ href: "/admin/promos", label: "Промокоды" }
]

/**
 * Премиум-навигация админки в стиле лендинга Talos:
 * стеклянный segmented-control с активной голубой плашкой.
 * Активный таб определяется автоматически по pathname,
 * но при необходимости можно явно передать `active` (href).
 * На «Поддержке» — бейдж числа тикетов с непрочитанными сообщениями.
 */
const AdminNav: FC<{ active?: string }> = ({ active }) => {
	const pathname = usePathname()

	const { data: supportUnread = 0 } = useQuery({
		queryKey: ["admin-support-unread"],
		queryFn: () => adminSupportService.unreadCount(),
		refetchInterval: 30_000
	})

	return (
		<nav className="flex w-full max-w-full flex-row flex-wrap gap-1.5 rounded-[16px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-1.5 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
			{NAV.map(item => {
				const isActive = active
					? active === item.href
					: pathname === item.href || pathname?.startsWith(item.href + "/")
				const badge = item.href === "/admin/support" && supportUnread > 0 ? supportUnread : null
				return (
					<Link
						key={item.href}
						href={item.href}
						className={`flex w-auto cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-4 py-1.5 text-sm font-semibold transition-colors ${
							isActive
								? "bg-[#2f6bff]/15 text-white ring-1 ring-[#6aa5ff]/25"
								: "text-white/55 hover:bg-white/[0.05] hover:text-white"
						}`}
					>
						{item.label}
						{badge !== null && (
							<span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff5c5c] px-1 text-[11px] font-bold text-white">
								{badge > 99 ? "99+" : badge}
							</span>
						)}
					</Link>
				)
			})}
		</nav>
	)
}

export default AdminNav
