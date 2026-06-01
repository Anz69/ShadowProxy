import type { Metadata } from "next"
import Layout from "@/shared/components/ui/Layout"
import { requireAuth } from "@/shared/server/requireAuth"
import { getPrices } from "@/shared/server/getPrices"
import { getPlans } from "@/shared/server/getPlans"
import DashboardClient from "./DashboardClient"

export const metadata: Metadata = {
	title: "Личный кабинет"
}

export default async function DashboardPage() {
	const user = await requireAuth()
	const prices = await getPrices()
	const plans = await getPlans()

	return (
		<Layout header={true} user={user}>
			<DashboardClient user={user} prices={prices} plans={plans} />
		</Layout>
	)
}
