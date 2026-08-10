/**
 * Форматирует цену, убирая лишние нули
 * @param price - цена для форматирования
 * @returns отформатированная цена без лишних нулей (например, 1 вместо 1.00, 1.5 вместо 1.50)
 */
export function formatPrice(price: number): string {
	// Проверяем, является ли число целым
	if (Number.isInteger(price)) {
		return price.toString()
	}
	
	// Форматируем с 2 знаками после запятой и убираем лишние нули в конце
	return price.toFixed(2).replace(/\.?0+$/, "")
}

