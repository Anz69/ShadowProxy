// Единицы нейтральные (MB/GB/TB) — читаются во всех локалях. Раньше были русские
// «мб/Гб», из-за чего в EN/zh на карточках проскакивал русский.
//
// Значения меньше мегабайта раньше отдавались как «0 MB»: у только что выданного
// прокси с парой килобайт расход выглядел как ноль, и это читалось как «учёт не
// работает». Теперь такие значения показываем в KB, а дробные MB не теряют знак.
export function formatTraffic(bytesStr: string): string {
	const bytes = parseInt(bytesStr, 10)
	if (isNaN(bytes) || bytes < 0) return "0 MB"
	if (bytes === 0) return "0 MB"

	// Меньше мегабайта — KB, чтобы реальный расход не выглядел нулём.
	if (bytes < 1024 ** 2) {
		const kb = bytes / 1024
		if (kb < 1) return `${bytes} B`
		return `${kb >= 10 ? Math.round(kb) : Number(kb.toFixed(1))} KB`
	}

	const units = ["MB", "GB", "TB"] as const
	const sizes = [1024 ** 2, 1024 ** 3, 1024 ** 4]

	for (let i = sizes.length - 1; i >= 0; i--) {
		if (bytes >= sizes[i]) {
			const traffic = bytes / sizes[i]
			// Округляем до одного знака, но не превращаем ненулевое значение в «0».
			const rounded = Number(traffic.toFixed(1))
			return `${rounded} ${units[i]}`
		}
	}

	return "0 MB"
}
