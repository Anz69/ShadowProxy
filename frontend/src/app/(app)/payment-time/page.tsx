import type { Metadata } from "next"

import PaymentTime from "@/features/payments/components/PaymentTime"

import Layout from "@/shared/components/ui/Layout"
import { getExchangeRates } from "@/shared/server/getExchangeRates"
import { getLocations } from "@/shared/server/getLocations"
import { getPlans } from "@/shared/server/getPlans"
import { getPrices } from "@/shared/server/getPrices"
import { requireAuth } from "@/shared/server/requireAuth"

export const metadata: Metadata = {
	title: "Оплата мобильных прокси"
}

export default async function Page() {
	const user = await requireAuth()
	const exchangeRates = await getExchangeRates()
	const locations = await getLocations()
	const plans = await getPlans()
	const prices = await getPrices()

	return (
		<Layout user={user}>
			<PaymentTime
				exchangeRates={exchangeRates}
				locations={locations.mobile}
				plans={plans}
				prices={prices}
				user={user}
			/>
		</Layout>
	)
}


