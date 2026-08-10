import type { Metadata } from "next"
import { notFound } from "next/navigation"

import MailSent from "@/features/auth/components/MailSent"

import Layout from "@/shared/components/ui/Layout"
import { getT } from "@/shared/server/getT"

export async function generateMetadata(): Promise<Metadata> {
	const T = await getT()
	return {
		title: T("auth.emailVerification.title")
	}
}

export default async function RegisterSuccessPage({
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
				overlay="email-confirmation"
				email={decodeURIComponent(atob(decodeURIComponent(email)))}
			/>
		</Layout>
	)
}
