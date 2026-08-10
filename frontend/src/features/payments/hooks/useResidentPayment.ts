import { useMutation } from "@tanstack/react-query"
import type { ResidentPaymentDto } from "@/features/payments/types/payment.types"
import { paymentService } from "@/features/payments/serices/payment.service"

export function useResidentPayment() {
	const {mutate: createResidentInvoice, isPending: isResidentInvoiceLoading} = useMutation({
		mutationKey: ["payment"],
		mutationFn: (dto: ResidentPaymentDto) => paymentService.createResidentInvoice(dto)
	})

	return {
		createResidentInvoice,
		isResidentInvoiceLoading
	}
}