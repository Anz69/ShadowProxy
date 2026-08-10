import { cookies } from "next/headers"
import type { AdminChartsStats } from "@/features/admin/types/admin.types"

export async function getAdminChartsStats(): Promise<AdminChartsStats | null> {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value
	if (!session) return null

	const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/admin/stats/charts`, {
		headers: {
			Cookie: `session=${session}`,
		},
		cache: "no-store",
	})

	if (!res.ok) return null
	const data = await res.json()
	return data as AdminChartsStats
}
