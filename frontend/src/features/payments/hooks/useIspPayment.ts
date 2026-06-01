import { useMutation } from "@tanstack/react-query"

import { paymentService } from "@/features/payments/serices/payment.service"
import type { IspPaymentDto } from "@/features/payments/types/payment.types"

export function useIspPayment() {
	const { mutate: createIspInvoice, isPending: isIspInvoiceLoading } =
		useMutation({
			mutationKey: ["payment"],
			mutationFn: (dto: IspPaymentDto) =>
				paymentService.createIspInvoice(dto)
		})

	return {
		createIspInvoice,
		isIspInvoiceLoading
	}
}
