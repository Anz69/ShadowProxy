import type { Metadata } from "next"

import Confirmation from "@/features/payments/components/Confirmation"

import Layout from "@/shared/components/ui/Layout"
import Loader from "@/shared/components/ui/Loader/Loader"
import { getExchangeRates } from "@/shared/server/getExchangeRates"
import { requireAuth } from "@/shared/server/requireAuth"
import { Suspense } from "react"

export const metadata: Metadata = {
	title: "Оплата"
}

export default async function Page() {
	const user = await requireAuth()
	const exchangeRates = await getExchangeRates()

	return (
		<Layout user={user}>
			<Suspense fallback={<Loader />}>
				<Confirmation exchangeRates={exchangeRates} />
			</Suspense>
		</Layout>
	)
}
