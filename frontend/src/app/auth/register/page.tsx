import type { Metadata } from "next"
import { Suspense } from "react"

import AuthSwitcher from "@/features/auth/components/AuthSwitcher"

import Layout from "@/shared/components/ui/Layout"
import Loader from "@/shared/components/ui/Loader/Loader"
import { getT } from "@/shared/server/getT"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("auth.register.title")
	}
}

export default function RegisterPage() {
	return (
		<Layout>
			<Suspense fallback={<Loader />}>
				<AuthSwitcher initialMode="register" />
			</Suspense>
		</Layout>
	)
}
