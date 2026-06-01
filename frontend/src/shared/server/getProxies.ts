import { cookies } from "next/headers"

import type { Proxy } from "@/features/proxy/types/proxy.types"

export async function getProxies() {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value
	if (!session) return null

	try {
		const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/proxy/my`, {
			headers: {
				Cookie: `session=${session}`
			},
			cache: "no-store"
		})

		if (!res.ok) return null
		const user = await res.json()
		return user as Proxy[]
	} catch (err) {
		console.error(`getProxies fetch failed: ${err instanceof Error ? err.message : String(err)}`)
		return null
	}
}
