export function formatDate(dateStr: string, withTime: boolean = false): string {
	const date = new Date(dateStr)
	const day = String(date.getDate()).padStart(2, "0")
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const year = date.getFullYear()
	const datePart = `${day}.${month}.${year}`
	if (withTime) {
		const hours = String(date.getHours()).padStart(2, "0")
		const minutes = String(date.getMinutes()).padStart(2, "0")
		return `${datePart} ${hours}:${minutes}`
	}
	return datePart
}