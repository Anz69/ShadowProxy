import type { Metadata } from "next"

import Broadcasts from "@/features/admin/components/Broadcasts"

import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Рассылки"
}

export default async function AdminBroadcastsPage() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<Broadcasts />
		</Layout>
	)
}
