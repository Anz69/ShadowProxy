import type { Metadata } from "next"
import { Suspense } from "react"

import EmailVerificationForm from "@/features/auth/components/EmailVerificationForm"

import Layout from "@/shared/components/ui/Layout"
import Loader from "@/shared/components/ui/Loader/Loader"
import { getT } from "@/shared/server/getT"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("auth.emailVerification.title")
	}
}

export default function Page() {
	return (
		<Layout header={true}>
			<Suspense fallback={<Loader />}>
				<EmailVerificationForm />
			</Suspense>
		</Layout>
	)
}
