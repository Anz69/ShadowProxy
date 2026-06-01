import type { Metadata } from "next"

import Dashboard from "@/features/admin/components/Dashboard"

import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Пользователи"
}

export default async function AdminUsersPage() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<Dashboard />
		</Layout>
	)
}
