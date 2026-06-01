export function formatTraffic(bytesStr: string): string {
	const bytes = parseInt(bytesStr, 10)
	if (isNaN(bytes) || bytes < 0) return "0 мб"

	const units = ["мб", "Гб", "Тб"] as const
	const sizes = [1024 ** 2, 1024 ** 3, 1024 ** 4]

	for (let i = sizes.length - 1; i >= 0; i--) {
		if (bytes >= sizes[i]) {
			const traffic = bytes / sizes[i]
			return `${traffic % 10 === 0 ? traffic : traffic.toFixed(1)} ${units[i]}`
		}
	}

	return "0 мб"
}
