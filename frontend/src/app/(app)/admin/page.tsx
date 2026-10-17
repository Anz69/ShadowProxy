import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getUser } from "@/shared/server/getUser"

export const metadata: Metadata = {
	title: "Админ панель"
}

export default async function Page() {
	const user = await getUser()
	// Поддержке доступен только раздел тикетов.
	return redirect(user?.role === "SUPPORT" ? "/admin/support" : "/admin/users")
}
