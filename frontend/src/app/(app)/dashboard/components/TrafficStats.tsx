"use client"

import { usePathname } from "next/navigation"
import type { User } from "@/features/user/types/user.types"
import { getLocaleFromPath } from "@/shared/utils/getLocaleFromPath"
import { t } from "@/shared/utils/i18n"

type TrafficStatsProps = {
	user: User | null
}

export default function TrafficStats({ user }: TrafficStatsProps) {
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
	const rows = [
		{ name: T("dashboard.trafficStats.resident"), ...format(user.premiumTrafficLeft) },
		{ name: T("dashboard.trafficStats.premiumResidential"), ...format(user.premiumResidentialTrafficLeft || "0") },
		{ name: T("dashboard.trafficStats.mobileNew"), ...format(user.mobileTrafficLeft || "0") }
	]

	// Относительная шкала: самый большой остаток = 100%, остальные пропорционально.
	// Это сравнительный индикатор величины, не «% израсходовано» (тотала нет).
	const maxBytes = Math.max(1, ...rows.map(r => r.bytes))

	return (
		<div className="traffic-stats">
			{rows.map((item, index) => (
				<div key={index} className="traffic-stats__row">
					<div className="traffic-stats__head">
						<span className="traffic-stats__label">
							{labelPrefix} {item.name}
						</span>
						<div className="traffic-stats__value">
							<span className="traffic-stats__value-number">{item.value}</span>
							<span className="traffic-stats__value-unit">{item.unit}</span>
						</div>
					</div>
					<div className="traffic-stats__bar">
						<span
							className="traffic-stats__bar-fill"
							style={{ width: `${Math.round((item.bytes / maxBytes) * 100)}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	)
}
