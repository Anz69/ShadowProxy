type TimeUnit = "сек" | "мин" | "час" | "д" | "нед" | "мес"

export function formatSeconds(sec: number): string {
	const units: [TimeUnit, number][] = [
		["мес", 60 * 60 * 24 * 30],
		["нед", 60 * 60 * 24 * 7],
		["д",   60 * 60 * 24],
		["час", 60 * 60],
		["мин", 60],
		["сек", 1],
	]

	for (const [unit, value] of units) {
		if (sec >= value) {
			const amount = Math.floor(sec / value)
			return `${amount} ${unit}`
		}
	}

	return "0 сек"
}
