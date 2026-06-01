import type { Metadata } from "next"
import { Suspense } from "react"

import LoginForm from "@/features/auth/components/LoginForm"

import Layout from "@/shared/components/ui/Layout"
import Loader from "@/shared/components/ui/Loader/Loader"
import { getT } from "@/shared/server/getT"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("auth.login.title")
	}
}

export default function LoginPage() {
	return (
		<Layout header={true}>
			<Suspense fallback={<Loader />}>
				<LoginForm />
			</Suspense>
		</Layout>
	)
}
