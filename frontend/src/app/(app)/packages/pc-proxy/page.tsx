import type { Metadata } from "next"
import Layout from "@/shared/components/ui/Layout"
import { requireAuth } from "@/shared/server/requireAuth"
import PcProxyPackageClient from "./PcProxyPackageClient"

export const metadata: Metadata = {
	title: "Пакет ПК прокси"
}

export default async function PcProxyPackagePage() {
	const user = await requireAuth()

	return (
		<Layout header={true} user={user}>
			<PcProxyPackageClient />
		</Layout>
	)
}







