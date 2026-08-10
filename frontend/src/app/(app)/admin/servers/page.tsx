import type { Metadata } from "next"
import { getUser } from "@/shared/server/getUser"
import Layout from "@/shared/components/ui/Layout"
import Servers from "@/features/admin/components/Servers"

export const metadata: Metadata = {
    title: "Серверы"
}

export default async function AdminServersPage() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<Servers />
		</Layout>
	)
}

