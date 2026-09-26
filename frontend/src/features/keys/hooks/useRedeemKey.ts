import { useMutation } from "@tanstack/react-query"
import toast from "react-hot-toast"

import type { RedeemKeyDto } from "@/features/keys/schemas/redeem-key.schema"
import { keysService } from "@/features/keys/services/keys.service"
import type { Key } from "@/features/keys/types/keys.types"

import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

const typeLabels: Record<string, string> = {
	RESIDENT: "Residential (старый тариф)",
	RESIDENT_PREMIUM: "Residential Proxy",
	ISP: "ISP (старый тариф)",
	MOBILE_GB: "Mobile GB (старый тариф)",
	IPV6_GB: "IPv6 GB (старый тариф)",
	RESIDENTIAL_LITE: "Residential Lite",
	ISP_USA: "ISP USA",
	ISP_EU: "ISP Netherlands",
	PREMIUM_RESIDENTIAL: "Premium Residential",
	MOBILE: "Premium Mobile"
}

export function useRedeemKey() {
	const { close } = useModalStore()

	const { mutate: redeemKey, isPending: isLoading } = useMutation({
		mutationKey: ["redeem-key"],
		mutationFn: (dto: RedeemKeyDto) => keysService.redeemKey(dto),
		onSuccess: (data: Key) => {
			const unit = (data.type as string) === "ISP" ? "IP" : "ГБ"
			const tariff = typeLabels[data.type] ?? data.type
			toast.success(
				`Ключ активирован: ${data.contents} ${unit} зачислено на баланс тарифа «${tariff}»`
			)
			close()
		}
	})

	return {
		redeemKey,
		isLoading
	}
}
