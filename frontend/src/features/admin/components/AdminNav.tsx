"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { FC } from "react"

const NAV = [
	{ href: "/admin/users", label: "Пользователи" },
	{ href: "/admin/stats", label: "Статистика" },
	{ href: "/admin/logs", label: "Логи" },
	{ href: "/admin/settings", label: "Настройки" },
	{ href: "/admin/keys", label: "Ключи" },
	{ href: "/admin/servers", label: "Серверы" },
	{ href: "/admin/reviews", label: "Отзывы" },
	{ href: "/admin/broadcasts", label: "Рассылки" }
]

/**
 * Премиум-навигация админки в стиле лендинга Talos:
 * стеклянный segmented-control с активной голубой плашкой.
 * Активный таб определяется автоматически по pathname,
 * но при необходимости можно явно передать `active` (href).
 */
const AdminNav: FC<{ active?: string }> = ({ active }) => {
	const pathname = usePathname()

	return (
		<nav className="flex w-full max-w-full flex-row flex-wrap gap-1.5 rounded-[16px] border border-white/[0.08] bg-[linear-gradient(180deg,#0e1830,#0a1020)] p-1.5 shadow-[0_24px_60px_-44px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
			{NAV.map(item => {
				const isActive = active
					? active === item.href
					: pathname === item.href || pathname?.startsWith(item.href + "/")
				return (
					<Link
						key={item.href}
						href={item.href}
						className={`flex w-auto cursor-pointer items-center justify-center whitespace-nowrap rounded-[10px] px-4 py-1.5 text-sm font-semibold transition-colors ${
							isActive
								? "bg-[#2f6bff]/15 text-white ring-1 ring-[#6aa5ff]/25"
								: "text-white/55 hover:bg-white/[0.05] hover:text-white"
						}`}
					>
						{item.label}
					</Link>
				)
			})}
		</nav>
	)
}

export default AdminNav
