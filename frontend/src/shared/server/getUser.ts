import type { User } from "@/features/user/types/user.types"
import { cookies } from "next/headers"

export async function getUser() {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value
	if (!session) return null
	const backendUri = process.env.NEXT_PUBLIC_BACKEND_URI
	if (!backendUri) {
		console.error("getUser: NEXT_PUBLIC_BACKEND_URI is not set")
		return null
	}

	try {
		const res = await fetch(`${backendUri}/users/me`, {
			headers: {
				Cookie: `session=${session}`
			},
			cache: "no-store"
		})

		if (!res.ok) {
			console.error(`getUser: API returned ${res.status} ${res.statusText}`)
			return null
		}
		const user = await res.json()
		return user as User
	} catch (err) {
		// Network / fetch error — return null so server component can render
		// and log for debugging.
		if (err instanceof Error) {
			console.error(`getUser fetch failed: ${err.name} - ${err.message}`)
			if (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
				console.error(`getUser: Backend is not available at ${backendUri}/users/me`)
				console.error("Make sure backend is running on http://localhost:8080")
			}
		} else {
			console.error("getUser fetch failed:", err)
		}
		return null
	}
}
