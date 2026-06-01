import { cookies } from "next/headers"
import type { UserStats } from "@/features/user/types/user.types"

export async function getUserStats() {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value
	if (!session) return null

	const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/users/stats`, {
		headers: {
			Cookie: `session=${session}`
		},
		cache: "no-store"
	})

	if (!res.ok) return null
	const user = await res.json()
	return user as UserStats
}
