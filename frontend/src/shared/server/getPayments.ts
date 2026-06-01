import { cookies } from "next/headers"

import type { Invoice } from "@/features/payments/types/payment.types"

export async function getPayments(): Promise<Invoice[]> {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value

	try {
		const res = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URI}/payments/my`,
			{
				headers: {
					Cookie: `session=${session}`
				},
				cache: "no-store"
			}
		)

		if (!res.ok) return []
		const data = await res.json()
		return Array.isArray(data) ? data : []
	} catch (err) {
		console.error(`getPayments fetch failed: ${err instanceof Error ? err.message : String(err)}`)
		return []
	}
}
