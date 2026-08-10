import type { Metadata } from "next"

import MailSent from "@/features/auth/components/MailSent"

import Layout from "@/shared/components/ui/Layout"
import { notFound } from "next/navigation"
import { getT } from "@/shared/server/getT"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("auth.resetPassword.title")
	}
}

export default async function ResetSuccessPage({
													  params
												  }: {
	params: Promise<{ email: string }>
}) {
	const email = (await params).email
	try {
		atob(decodeURIComponent(email))
	} catch {
		return notFound()
	}
	return (
		<Layout>
			<MailSent
				overlay="password-reset"
				email={decodeURIComponent(atob(decodeURIComponent(email)))}
			/>
		</Layout>
	)
}
