import type { Metadata } from "next"
import Layout from "@/shared/components/ui/Layout"
import { requireAuth } from "@/shared/server/requireAuth"
import { getPrices } from "@/shared/server/getPrices"
import { getPlans } from "@/shared/server/getPlans"
import DashboardClient from "./DashboardClient"
import PageBackground from "@/shared/components/widgets/PageBackground"
import DashboardDots from "./components/DashboardDots"

export const metadata: Metadata = {
	title: "Личный кабинет"
}

export default async function DashboardPage() {
	const user = await requireAuth()
	const prices = await getPrices()
	const plans = await getPlans()

	return (
		<Layout header={true} user={user}>
			<div className="relative min-h-screen w-full overflow-hidden font-[TalosInter] text-white light:text-[#0e1019]">
				<PageBackground />
				<DashboardDots />
				<div className="relative z-[1]">
					<DashboardClient user={user} prices={prices} plans={plans} />
				</div>
			</div>
		</Layout>
	)
}
