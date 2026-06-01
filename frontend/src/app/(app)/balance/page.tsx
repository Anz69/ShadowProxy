import type { Metadata } from "next"

import BalanceReplenish from "@/features/payments/components/BalanceReplenish"

import Layout from "@/shared/components/ui/Layout"
import { getExchangeRates } from "@/shared/server/getExchangeRates"
import { getPackages } from "@/shared/server/getPackages"
import { requireAuth } from "@/shared/server/requireAuth"
import { getPayments } from "@/shared/server/getPayments"

export const metadata: Metadata = {
	title: "Пополнение баланса"
}

export default async function Page() {
	const user = await requireAuth()
	const exchangeRates = await getExchangeRates()
	const packages = await getPackages()
	const payments = await getPayments()

	return (
		<Layout user={user}>
			<BalanceReplenish
				exchangeRates={exchangeRates}
				packages={packages}
				payments={payments}
				user={user}
			/>
		</Layout>
	)
}

