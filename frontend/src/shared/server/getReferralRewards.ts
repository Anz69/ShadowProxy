import { cookies } from "next/headers"

export type ReferralReward = {
	id: string
	referralName: string
	tariffType: string
	amount: number
	createdAt: string
}

export async function getReferralRewards(): Promise<ReferralReward[]> {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value
	if (!session) return []

	const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/users/referrals/rewards`, {
		headers: {
			Cookie: `session=${session}`
		},
		cache: "no-store"
	})

	if (!res.ok) return []
	const data = await res.json()
	return data as ReferralReward[]
}


