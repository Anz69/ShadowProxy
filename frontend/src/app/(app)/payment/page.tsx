import type { Metadata } from "next"

import Replenish from "@/features/payments/components/Replenish"

import Layout from "@/shared/components/ui/Layout"
import { getExchangeRates } from "@/shared/server/getExchangeRates"
import { getPackages } from "@/shared/server/getPackages"
import { getPrices } from "@/shared/server/getPrices"
import { requireAuth } from "@/shared/server/requireAuth"
import { getPayments } from "@/shared/server/getPayments"

export const metadata: Metadata = {
	title: "Пополнение"
}

export default async function Page() {
	const user = await requireAuth()
	const exchangeRates = await getExchangeRates()
	const packages = await getPackages()
	const prices = await getPrices()
	const payments = await getPayments()

	return (
		<Layout user={user}>
			<Replenish
				exchangeRates={exchangeRates}
				packages={packages}
				prices={prices}
				payments={payments}
				user={user}
			/>
		</Layout>
	)
}
