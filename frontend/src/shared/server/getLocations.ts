import type { Locations } from "@/features/proxy/types/proxy.types"

export async function getLocations(): Promise<Locations> {
	const backendUri = process.env.NEXT_PUBLIC_BACKEND_URI
	if (!backendUri) return {} as Locations

	try {
		const res = await fetch(`${backendUri}/proxy/locations`, {
			next: { revalidate: 300 }
		})
		if (!res.ok) return {} as Locations
		const data = await res.json()
		return (data ?? {}) as Locations
	} catch (err) {
		console.error(`getLocations fetch failed: ${err instanceof Error ? err.message : String(err)}`)
		return {} as Locations
	}
}
