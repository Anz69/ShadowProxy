import type { Metadata } from "next"
import Layout from "@/shared/components/ui/Layout"
import { requireAuth } from "@/shared/server/requireAuth"
import { getReferralsCount } from "@/shared/server/getReferralsCount"
import { getReferralRewards } from "@/shared/server/getReferralRewards"
import { getT } from "@/shared/server/getT"
import ReferralClient from "./ReferralClient"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("referral.title")
	}
}

export default async function ReferralPage() {
	const user = await requireAuth()
	const [referralsCount, referralRewards] = await Promise.all([
		getReferralsCount(),
		getReferralRewards()
	])

	return (
		<Layout header={true} user={user}>
			<ReferralClient user={user} referralsCount={referralsCount ?? 0} referralRewards={referralRewards} />
		</Layout>
	)
}

