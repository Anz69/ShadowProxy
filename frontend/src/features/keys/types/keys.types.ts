import type { RechargeableProxyType } from "@/features/proxy/types/proxy.types"

export type Key = {
	id: string
	key: string
	status: KeyStatus
	activatedBy: null | string
	type: RechargeableProxyType
	contents: number
	createdAt: string
}

export type KeyStatus = "NEW" | "ACTIVATED"