import type { Metadata } from "next"
import AdminPromos from "@/features/promos/components/AdminPromos"
import Layout from "@/shared/components/ui/Layout"
import PageBackground from "@/shared/components/widgets/PageBackground"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = { title: "Промокоды" }

export default async function AdminPromosPage() {
	const user = await getUser()
	return <Layout user={user}><div className="relative min-h-screen py-8"><PageBackground /><AdminPromos /></div></Layout>
}
