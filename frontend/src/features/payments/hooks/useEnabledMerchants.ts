import { useQuery } from "@tanstack/react-query"
import axios from "axios"

import type { Merchant } from "@/features/payments/types/payment.types"

type EnabledMerchants = Partial<Record<Merchant, boolean>>

/** Мерчанты, у которых на бэкенде есть ключи. Пока ответа нет — показываем всех. */
export function useEnabledMerchants() {
	const query = useQuery({
		queryKey: ["enabled-merchants"],
		queryFn: async () => {
			const res = await axios.get<EnabledMerchants>(`${process.env.NEXT_PUBLIC_BACKEND_URI}/payments/merchants`)
			return res.data
		},
		staleTime: 300_000,
		retry: 1
	})
	const isEnabled = (m: Merchant) => (query.data ? query.data[m] !== false : true)
	return { isEnabled, data: query.data }
}
