import type { Metadata } from "next"

import ProxyTests from "@/features/admin/components/ProxyTests"

import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Проверка прокси"
}

export default async function AdminProxyTestsPage() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<ProxyTests />
		</Layout>
	)
}
