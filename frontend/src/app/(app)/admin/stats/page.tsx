import type { Metadata } from "next"

import Statistics from "@/features/admin/components/Statistics"
import { EMPTY_ADMIN_STATS } from "@/features/admin/types/admin.types"

import Layout from "@/shared/components/ui/Layout"
import { getAdminChartsStats } from "@/shared/server/getAdminChartsStats"
import { getUser } from "@/shared/server/getUser"
import { getAdminStats } from "@/shared/server/getAdminStats"

export const metadata: Metadata = {
	title: "Статистика"
}

export default async function AdminStatsPage() {
	const user = await getUser()
	const [adminStats, chartsData] = await Promise.all([getAdminStats(), getAdminChartsStats()])

	return (
		<Layout user={user}>
			<Statistics stats={adminStats ?? EMPTY_ADMIN_STATS} chartsData={chartsData} />
		</Layout>
	)
}
