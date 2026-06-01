"use client"

import RefreshProxy from "@/features/proxy/components/RefreshProxy"

import Layout from "@/shared/components/ui/Layout"

export default function Error({
	error,
}: {
	error: Error & { digest?: string }
}) {
	return (
		<Layout header={false}>
			<RefreshProxy success={false} error={error.digest ?? "Неизвестная ошибка"} />
		</Layout>
	)
}
