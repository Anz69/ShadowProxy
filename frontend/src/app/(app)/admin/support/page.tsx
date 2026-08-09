import type { Metadata } from "next"

import AdminSupport from "@/features/admin/components/support/AdminSupport"

import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Поддержка — админ"
}

export default async function AdminSupportPage() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<AdminSupport />
		</Layout>
	)
}
