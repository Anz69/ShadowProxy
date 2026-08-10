import { cookies } from "next/headers"

export async function getReferralsCount(): Promise<number | null> {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value
	if (!session) return null

	const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/users/referrals/count`, {
		headers: {
			Cookie: `session=${session}`
		},
		cache: "no-store"
	})

	if (!res.ok) return null
	const data = await res.json()
	return data.count as number
}

