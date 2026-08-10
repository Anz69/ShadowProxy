import type { Package } from "@/features/packages/types/packages.types"

export async function getPackages(): Promise<Package[]> {
	const backendUri = process.env.NEXT_PUBLIC_BACKEND_URI
	if (!backendUri) {
		console.error("getPackages: NEXT_PUBLIC_BACKEND_URI is not set")
		return []
	}

	try {
		const res = await fetch(`${backendUri}/package/all`, {
			next: { revalidate: 300 }
		})

		if (!res.ok) {
			console.error(`getPackages: API returned ${res.status} ${res.statusText}`)
			return []
		}

		const data = await res.json()
		return Array.isArray(data) ? (data as Package[]) : []
	} catch (err) {
		// Сетевая ошибка (ECONNREFUSED / fetch failed) — не валим SSR, отдаём пустой список.
		console.error(
			`getPackages fetch failed: ${err instanceof Error ? `${err.name} - ${err.message}` : String(err)}`
		)
		return []
	}
}
