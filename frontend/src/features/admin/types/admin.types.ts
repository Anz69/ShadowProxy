export type AdminStats = {
	proxy: TimeStats & ProxyTypeStats
	replenish: TimeStats & ProxyTypeStats
	usageGb: TimeStats & ProxyTypeStats
	/** Общее число зарегистрированных пользователей (ТЗ 3.4). */
	usersTotal?: number
}

export type ProxyTypeStats = {
	resident: TimeStats
	premium: TimeStats
	premiumResidential: TimeStats
	mobile: TimeStats
	mobileGb: TimeStats
	ipv6: TimeStats
}

export type TimeStats = {
	hour: number
	day: number
	week: number
	month: number
}

const zeros: TimeStats = { hour: 0, day: 0, week: 0, month: 0 }
const emptyProxyType: ProxyTypeStats = {
	resident: { ...zeros },
	premium: { ...zeros },
	premiumResidential: { ...zeros },
	mobile: { ...zeros },
	mobileGb: { ...zeros },
	ipv6: { ...zeros },
}
const emptyBlock = { ...zeros, ...emptyProxyType }

/** Пустая статистика для отображения блоков, когда данных ещё нет */
export const EMPTY_ADMIN_STATS: AdminStats = {
	usersTotal: 0,
	proxy: { ...emptyBlock },
	replenish: { ...emptyBlock },
	usageGb: {
		...emptyBlock,
		mobile: { hour: 999, day: 999, week: 999, month: 999 },
	},
}

/** Данные для графиков админки */
export type AdminChartsStats = {
	/** Посещений за текущий месяц по дням (Cloudflare), null если не настроено */
	monthlyVisits?: { byDay: { date: string; visits: number }[]; total: number } | null
	revenue: {
		byDay: { date: string; sum: number; count: number }[]
		byWeek: { date: string; sum: number; count: number }[]
		byMonth: { date: string; sum: number; count: number }[]
		totalDay: { sum: number; count: number }
		totalWeek: { sum: number; count: number }
		totalMonth: { sum: number; count: number }
	}
	newUsers: {
		byDay: { date: string; count: number }[]
		byWeek: { date: string; count: number }[]
		byMonth: { date: string; count: number }[]
	}
	trafficByDay: {
		date: string
		totalGb: number
		resident: number
		premium: number
		premiumResidential: number
		mobile: number
		mobileGb: number
		ipv6: number
	}[]
	trafficByWeek: {
		date: string
		totalGb: number
		resident: number
		premium: number
		premiumResidential: number
		mobile: number
		mobileGb: number
		ipv6: number
	}[]
	trafficByMonth: {
		date: string
		totalGb: number
		resident: number
		premium: number
		premiumResidential: number
		mobile: number
		mobileGb: number
		ipv6: number
	}[]
	trafficByType: {
		resident: number
		premium: number
		premiumResidential: number
		mobile: number
		mobileGb: number
		ipv6: number
	}
	activity: {
		activeUsers: {
			byHour: { date: string; count: number }[]
			byDay: { date: string; count: number }[]
			byWeek: { date: string; count: number }[]
			byMonth: { date: string; count: number }[]
		}
		proxyGenerations: {
			byHour: { date: string; count: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }[]
			byDay: { date: string; count: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }[]
			byWeek: { date: string; count: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }[]
			byMonth: { date: string; count: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }[]
		}
	}
}
