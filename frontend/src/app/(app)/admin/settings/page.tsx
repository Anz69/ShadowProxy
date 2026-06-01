import type { Metadata } from "next"

import Settings from "@/features/admin/components/Settings"

import Layout from "@/shared/components/ui/Layout"
import { getPrices } from "@/shared/server/getPrices"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Настройки"
}

export default async function AdminSettingsPage() {
	const user = await getUser()
	const prices = await getPrices()

	return (
		<Layout user={user}>
			<Settings prices={prices} />
		</Layout>
	)
}
