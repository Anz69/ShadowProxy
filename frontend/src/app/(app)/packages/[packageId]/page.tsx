import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Layout from "@/shared/components/ui/Layout"
import { requireAuth } from "@/shared/server/requireAuth"
import { getPrices } from "@/shared/server/getPrices"
import { getPlans } from "@/shared/server/getPlans"
import PackagePageClient from "./PackagePageClient"
import MobProxyPackageClient from "../mob-proxy/MobProxyPackageClient"
import { getMyPackages } from "@/shared/server/getMyPackages"

export const metadata: Metadata = {
	title: "Пакет"
}

export default async function PackagePage({
	params
}: {
	params: Promise<{ packageId: string }>
}) {
	const packageId = (await params).packageId
	const user = await requireAuth()
	const prices = await getPrices()
	const plans = await getPlans()
	const userPackages = await getMyPackages()

	// Ищем UserPackage по его id (packageId в URL - это id UserPackage, а не Package)
	const userPackage = userPackages.find(up => up.id === packageId)

	if (!userPackage) {
		return notFound()
	}

	// Для мобильных прокси используем специальный шаблон
	// Используем type из UserPackage (тариф)
	const packageType = userPackage.type as string
	
	// Создаем минимальный объект Package для совместимости с компонентами
	const packageData = {
		id: userPackage.id,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		type: userPackage.type as any,
		traffic: "0",
		price: 0,
		createdAt: userPackage.createdAt
	}
	
	// Legacy MOBILE (LTE Socks, по времени) — есть planId и rentTime → отдельный UI с таймером.
	// Новый MOBILE (GB-based, ProxyEmpire) — planId/rentTime отсутствуют → стандартный UI как у MOBILE_GB.
	const isLegacyMobile =
		packageType === "MOBILE" &&
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		Boolean((userPackage as any).planId) &&
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		Boolean((userPackage as any).rentTime)

	if (isLegacyMobile) {
		return (
			<Layout header={true} user={user}>
				<MobProxyPackageClient packageData={packageData} user={user} prices={prices} plans={plans} />
			</Layout>
		)
	}

	return (
		<Layout header={true} user={user}>
			<PackagePageClient packageData={packageData} user={user} prices={prices} packageType={userPackage.type} />
		</Layout>
	)
}

