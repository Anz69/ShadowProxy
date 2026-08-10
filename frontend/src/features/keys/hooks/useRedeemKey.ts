import { useMutation } from "@tanstack/react-query"
import toast from "react-hot-toast"

import type { RedeemKeyDto } from "@/features/keys/schemas/redeem-key.schema"
import { keysService } from "@/features/keys/services/keys.service"
import type { Key } from "@/features/keys/types/keys.types"

import { useModalStore } from "@/shared/components/ui/Modal/store/modal.store"

const typeLabels: Record<string, string> = {
	RESIDENT: "резидентских прокси",
	RESIDENT_PREMIUM: "премиум прокси",
	ISP: "для ISP прокси",
	MOBILE_GB: "мобильных прокси",
	IPV6_GB: "IPv6 прокси"
}

export function useRedeemKey() {
	const { close } = useModalStore()

	const { mutate: redeemKey, isPending: isLoading } = useMutation({
		mutationKey: ["redeem-key"],
		mutationFn: (dto: RedeemKeyDto) => keysService.redeemKey(dto),
		onSuccess: (data: Key) => {
			toast.success(
				`На ваш баланс зачислено ${data.contents} ${(data.type as string) === "ISP" ? "IP" : "Гб"} ${typeLabels[data.type]}`
			)
			close()
		}
	})

	return {
		redeemKey,
		isLoading
	}
}
