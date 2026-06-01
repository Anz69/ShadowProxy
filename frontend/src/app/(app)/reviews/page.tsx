import type { Metadata } from "next"
import ReviewRouteLauncher from "@/features/reviews/components/ReviewRouteLauncher"
import { requireAuth } from "@/shared/server/requireAuth"

export const metadata: Metadata = {
	title: "Отзыв"
}

export default async function ReviewsPage() {
	await requireAuth()

	return <ReviewRouteLauncher />
}
