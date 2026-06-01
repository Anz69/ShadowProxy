import type { Metadata } from "next"

import ResetPasswordForm from "@/features/auth/components/ResetPasswordForm"

import Layout from "@/shared/components/ui/Layout"
import { getT } from "@/shared/server/getT"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("auth.resetPassword.title")
	}
}

export default function ResetPasswordPage() {
	return (
		<Layout>
			<ResetPasswordForm />
		</Layout>
	)
}
