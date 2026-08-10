"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"

export default function RefPage() {
	const router = useRouter()
	const params = useParams()
	const userId = params?.userId as string

	useEffect(() => {
		if (!userId) {
			router.push("/auth/register")
			return
		}

		// Сохраняем referrer в куки на месяц
		const expires = new Date()
		expires.setMonth(expires.getMonth() + 1)
		document.cookie = `referrer=${userId}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`

		// Редирект на страницу регистрации
		router.push("/auth/register")
	}, [userId, router])

	return null
}

