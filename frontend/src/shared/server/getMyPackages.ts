import type { UserPackage } from "@/features/packages/types/user-package.types"
import { cookies } from "next/headers"

export async function getMyPackages(): Promise<UserPackage[]> {
	const requestCookies = await cookies()
	const session = requestCookies.get("session")?.value

	try {
		// Не кэшировать: после оплаты вебхук обновляет пакеты; кэш давал 404 на /packages/[id] до F5
		const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URI}/package/user/my`, {
			headers: session ? { Cookie: `session=${session}` } : {},
			cache: "no-store",
		})

		if (!res.ok) {
			console.error(`getMyPackages: API returned ${res.status}`)
			return []
		}

		const data = await res.json()
		return Array.isArray(data) ? data : []
	} catch (err) {
		console.error(`getMyPackages fetch failed: ${err instanceof Error ? err.message : String(err)}`)
		return []
	}
}
