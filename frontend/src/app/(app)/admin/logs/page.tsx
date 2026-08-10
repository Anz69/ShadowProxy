import type { Metadata } from "next"

import Logs from "@/features/admin/components/Logs"

import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Логи"
}

export default async function AdminLogsPage() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<Logs />
		</Layout>
	)
}

