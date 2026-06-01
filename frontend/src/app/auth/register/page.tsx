import type { Metadata } from "next"

import RegisterForm from "@/features/auth/components/RegisterForm"

import Layout from "@/shared/components/ui/Layout"
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
			<RegisterForm />
		</Layout>
	)
}
