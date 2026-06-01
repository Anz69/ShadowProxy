import type { Plan } from "@/features/proxy/types/proxy.types"

export async function getPlans(): Promise<Plan[]> {
	const backendUri = process.env.NEXT_PUBLIC_BACKEND_URI
	if (!backendUri) return []

	try {
		const res = await fetch(`${backendUri}/proxy/plans`, {
			next: { revalidate: 300 }
		})
		if (!res.ok) return []
		const data = await res.json()
		return Array.isArray(data) ? (data as Plan[]) : []
	} catch (err) {
		console.error(`getPlans fetch failed: ${err instanceof Error ? err.message : String(err)}`)
		return []
	}
}
