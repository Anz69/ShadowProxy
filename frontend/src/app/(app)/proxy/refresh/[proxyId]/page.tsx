import type { Metadata } from "next"
import { notFound } from "next/navigation"

import RefreshProxy from "@/features/proxy/components/RefreshProxy"

import Layout from "@/shared/components/ui/Layout"
import { refreshProxy } from "@/shared/server/refreshProxy"

export const metadata: Metadata = {
	title: "Смена айпи"
}

export default async function RefreshPage({
	params
}: {
	params: Promise<{ proxyId: string }>
}) {
	const proxyId = (await params).proxyId

	if (!proxyId) {
		return notFound()
	}

	const refresh = await refreshProxy(proxyId)

	if (!refresh.success) {
		const err = new Error("refresh_failed")
		;(err as unknown as { digest: string }).digest = refresh.message
		throw err
	}

	return (
		<Layout header={false}>
			<RefreshProxy success={refresh.success} newIp={refresh.ip} />
		</Layout>
	)
}
