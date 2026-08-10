import type { Metadata } from "next"
import Layout from "@/shared/components/ui/Layout"
import { requireAuth } from "@/shared/server/requireAuth"
import MobProxyPackageClient from "./MobProxyPackageClient"

export const metadata: Metadata = {
	title: "Пакет мобильных прокси"
}

export default async function MobProxyPackagePage() {
	const user = await requireAuth()

	return (
		<Layout header={true} user={user}>
			<MobProxyPackageClient />
		</Layout>
	)
}




