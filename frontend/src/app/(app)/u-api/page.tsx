import type { Metadata } from "next"
import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"
import { getT } from "@/shared/server/getT"
import ApiPageClient from "@/app/(app)/api/ApiPageClient"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("api.title")
	}
}

export default async function UApiPage() {
	const user = await getUser()

	return (
		<Layout header={true} user={user}>
			<ApiPageClient user={user} />
		</Layout>
	)
}
