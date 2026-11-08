import type { Metadata } from "next"
import CampaignDetail from "@/features/marketing/components/CampaignDetail"
import Layout from "@/shared/components/ui/Layout"
import PageBackground from "@/shared/components/widgets/PageBackground"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = { title: "Кампания · UTM-аналитика" }

export default async function AdminCampaignPage({ params }: { params: Promise<{ id: string }> }) {
	const [user, { id }] = await Promise.all([getUser(), params])
	return <Layout user={user}><div className="relative min-h-screen py-8"><PageBackground /><CampaignDetail id={id} /></div></Layout>
}
