import type { Metadata } from "next"
import { getUser } from "@/shared/server/getUser"
import Layout from "@/shared/components/ui/Layout"
import Keys from "@/features/admin/components/Keys"

export const metadata: Metadata = {
    title: "Ключи"
}

export default async function Page() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<Keys />
		</Layout>
	)
}