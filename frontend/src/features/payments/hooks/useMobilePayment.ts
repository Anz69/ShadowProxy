import { useMutation } from "@tanstack/react-query"

import { paymentService } from "@/features/payments/serices/payment.service"
import type { MobilePaymentDto } from "@/features/payments/types/payment.types"

export function useMobilePayment() {
	const { mutate: createInvoice, isPending: isLoading } = useMutation({
		mutationKey: ["payment mobile"],
		mutationFn: (dto: MobilePaymentDto) =>
			paymentService.createMobileInvoice(dto)
	})

	return {
		createInvoice,
		isLoading
	}
}
