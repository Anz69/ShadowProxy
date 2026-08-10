export async function refreshProxy(
	proxyId: string
): Promise<
	{ success: true; ip: string } | { success: false; message: string }
> {
	const res = await fetch(
		`${process.env.NEXT_PUBLIC_BACKEND_URI}/proxy/refresh/${proxyId}`,
		{
			method: "POST"
		}
	)

	const data = await res.json()

	if (!!data?.message) {
		return {
			success: false,
			message: data.message
		}
	}

	return {
		success: true,
		ip: data.ip
	}
}
