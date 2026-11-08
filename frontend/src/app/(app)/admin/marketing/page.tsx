import type { Metadata } from "next"
import AdminMarketing from "@/features/marketing/components/AdminMarketing"
import Layout from "@/shared/components/ui/Layout"
import PageBackground from "@/shared/components/widgets/PageBackground"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = { title: "UTM-аналитика" }

export default async function AdminMarketingPage() {
	const user = await getUser()
	return <Layout user={user}><div className="relative min-h-screen py-8"><PageBackground /><AdminMarketing /></div></Layout>
}
