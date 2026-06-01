export function extractError(e: unknown) {
	const typedE = e as {
		response?: { data?: { message?: string | string[] } }
	}

	const message = typedE.response?.data?.message

	if (!message) {
		return "Не удалось выполнить запрос"
	}

	return Array.isArray(message) ? message[0] : message
}
