import type { Metadata } from "next"

import Reviews from "@/features/admin/components/Reviews"

import Layout from "@/shared/components/ui/Layout"
import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Отзывы"
}

export default async function AdminReviewsPage() {
	const user = await getUser()

	return (
		<Layout user={user}>
			<Reviews />
		</Layout>
	)
}
