import type { Metadata } from "next"

import ResetPasswordForm from "@/features/auth/components/ResetPasswordForm"

import Layout from "@/shared/components/ui/Layout"
import Loader from "@/shared/components/ui/Loader/Loader"
import { getT } from "@/shared/server/getT"
import { Suspense } from "react"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("auth.resetPassword.title")
	}
}

export default function ProcessResetPasswordPage() {
	return (
		<Layout>
			<Suspense fallback={<Loader />}>
				<ResetPasswordForm />
			</Suspense>
		</Layout>
	)
}
