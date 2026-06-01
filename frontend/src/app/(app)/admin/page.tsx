import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
	title: "Админ панель"
}

export default function Page() {
	return redirect("/admin/users")
}
