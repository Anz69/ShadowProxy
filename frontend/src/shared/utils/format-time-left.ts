export function formatTimeLeft(
	createdAt: string,
	availableSeconds: number
): string {
	const created = new Date(createdAt).getTime()
	const expiresAt = created + availableSeconds * 1000
	const diff = expiresAt - Date.now()

	if (diff <= 0) return "0 мин"

	let seconds = Math.floor(diff / 1000)

	const days = Math.floor(seconds / 86400)
	seconds %= 86400
	const hours = Math.floor(seconds / 3600)
	seconds %= 3600
	const minutes = Math.floor(seconds / 60)

	const parts: string[] = []
	if (days > 0) parts.push(`${days} д`)
	if (hours > 0) parts.push(`${hours} ч`)
	if (minutes > 0 && days === 0) parts.push(`${minutes} мин`)

	return parts.join(" ")
}
