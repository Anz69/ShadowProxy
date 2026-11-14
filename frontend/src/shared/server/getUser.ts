import type { User } from "@/features/user/types/user.types"
import { cookies } from "next/headers"

const FETCH_TIMEOUT_MS = 5000

async function fetchUser(backendUri: string, session: string): Promise<User | null> {
	const res = await fetch(`${backendUri}/users/me`, {
		headers: {
			Cookie: `session=${session}`
		},
		cache: "no-store",
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	})

	if (!res.ok) {
		// 401/403 — сессия точно мертва. 5xx — временная проблема backend,
		// бросаем, чтобы вызывающий код мог сделать ретрай, а не разлогин.
		if (res.status === 401 || res.status === 403) return null
		throw new Error(`getUser: API returned ${res.status} ${res.statusText}`)
	}
	return (await res.json()) as User
}

export async function getUser() {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value
	if (!session) return null
	const backendUri = process.env.NEXT_PUBLIC_BACKEND_URI
	if (!backendUri) {
		console.error("getUser: NEXT_PUBLIC_BACKEND_URI is not set")
		return null
	}

	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			return await fetchUser(backendUri, session)
		} catch (err) {
			// Сетевая ошибка/таймаут/5xx — один быстрый ретрай, чтобы временный
			// сбой backend не выкидывал пользователя на страницу логина.
			if (err instanceof Error) {
				console.error(`getUser attempt ${attempt + 1} failed: ${err.name} - ${err.message}`)
			} else {
				console.error(`getUser attempt ${attempt + 1} failed:`, err)
			}
		}
	}
	return null
}
