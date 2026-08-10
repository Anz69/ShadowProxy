import type { RechargeableProxyType } from "@/features/proxy/types/proxy.types"

export type Package = {
	id: string,
	type: RechargeableProxyType,
	traffic: string,
	price: number,
	createdAt: string
}