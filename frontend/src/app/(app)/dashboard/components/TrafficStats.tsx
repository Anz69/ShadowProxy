"use client"

import { usePathname } from "next/navigation"
import type { User } from "@/features/user/types/user.types"
import type { UserPackage } from "@/features/packages/types/user-package.types"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

type TrafficStatsProps = {
	user: User | null
	packages?: UserPackage[]
}

export default function TrafficStats({ user, packages }: TrafficStatsProps) {
	const pathname = usePathname()
	const currentLocale = getLocaleFromPath(pathname)
	const T = (key: string) => t(key, currentLocale)

	if (!user) return null

	// Форматируем трафик: < 1 ГБ → МБ, иначе ГБ (без лишних нулей).
	const format = (bytesStr: string): { value: string; unit: string; bytes: number } => {
		const bytes = Number(BigInt(bytesStr || "0"))
		if (bytes === 0) return { value: "0", unit: "GB", bytes: 0 }
		const gb = bytes / 1024 ** 3
		if (gb < 1) {
			const mb = bytes / 1024 ** 2
			return { value: parseFloat(mb.toFixed(2)).toString(), unit: "MB", bytes }
		}
		return { value: parseFloat(gb.toFixed(2)).toString(), unit: "GB", bytes }
	}

	const labelPrefix = T("dashboard.trafficStats.remainingTraffic")

	// Израсходованный трафик по типу (из пакетов, in+out). Куплено = остаток + used.
	const usedByType: Record<string, number> = {}
	for (const p of packages ?? []) {
		if (p?.type && p.usedTraffic != null) {
			usedByType[p.type] = (usedByType[p.type] ?? 0) + Number(BigInt(p.usedTraffic || "0"))
		}
	}

	const allRows = [
		{ name: T("dashboard.trafficStats.resident"), type: "RESIDENT_PREMIUM", ...format(user.premiumTrafficLeft) },
		{ name: T("dashboard.trafficStats.premiumResidential"), type: "PREMIUM_RESIDENTIAL", ...format(user.premiumResidentialTrafficLeft || "0") },
		{ name: T("dashboard.trafficStats.ispUsa"), type: "ISP_USA", ...format((user as unknown as Record<string, string>).ispUsaTrafficLeft || "0") },
		{ name: T("dashboard.trafficStats.ispEu"), type: "ISP_EU", ...format((user as unknown as Record<string, string>).ispEuTrafficLeft || "0") },
		{ name: T("dashboard.trafficStats.residentialLite"), type: "RESIDENTIAL_LITE", ...format((user as unknown as Record<string, string>).residentialLiteTrafficLeft || "0") },
		{ name: T("dashboard.trafficStats.mobile"), type: "MOBILE_GB", ...format(user.mobileGbTrafficLeft || "0") },
		{ name: T("dashboard.trafficStats.mobileNew"), type: "MOBILE", ...format(user.mobileTrafficLeft || "0") },
		{ name: T("dashboard.trafficStats.ipv6"), type: "IPV6_GB", ...format(user.ipv6GbTrafficLeft || "0") }
	]

	// Показываем баланс ТОЛЬКО по типам, на которые у юзера есть купленный пакет —
	// чтобы левая карточка баланса совпадала с правым списком пакетов (иначе виден
	// «остаток» по типу, которого справа нет — сбивает с толку).
	const ownedTypes = new Set((packages ?? []).map(p => p.type as string))
	const owned = allRows.filter(r => ownedTypes.has(r.type))
	// Фолбэк (пакеты ещё не подгрузились): показываем ненулевые, иначе базовые три.
	const nonZero = allRows.filter(r => r.bytes > 0)
	const rows = owned.length ? owned : nonZero.length ? nonZero : allRows.slice(0, 3)

	// Полоска = «осталось из купленного»: остаток / (остаток + израсходовано).
	const fillPct = (row: { type: string; bytes: number }): number => {
		const used = usedByType[row.type] ?? 0
		const total = row.bytes + used
		return total > 0 ? Math.round((row.bytes / total) * 100) : 0
	}

	return (
		<div className="flex flex-col gap-3">
			{rows.map((item, index) => (
				<div key={index} className="flex flex-col gap-1.5">
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-[13px] text-white/45 light:text-[#5b6472]">
							{labelPrefix} {item.name}
						</span>
						<div className="flex items-baseline gap-1">
							<span className="font-[TalosDisplay] text-[15px] font-bold text-white light:text-[#0e1019]">{item.value}</span>
							<span className="text-[12px] text-white/45 light:text-[#8a93a3]">{item.unit}</span>
						</div>
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06] light:bg-black/[0.06]">
						<span
							className="block h-full rounded-full bg-gradient-to-r from-[#4f8dff] to-[#6aa5ff] transition-[width] duration-500"
							style={{ width: `${fillPct(item)}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	)
}
