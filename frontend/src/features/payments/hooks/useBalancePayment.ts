import { useMutation } from "@tanstack/react-query"
import type { BalancePaymentDto } from "@/features/payments/types/payment.types"
import { paymentService } from "@/features/payments/serices/payment.service"

export function useBalancePayment() {
	const { mutate: createBalanceInvoice, isPending: isBalanceInvoiceLoading } = useMutation({
		mutationKey: ["payment", "balance"],
		mutationFn: (dto: BalancePaymentDto) => paymentService.createBalanceInvoice(dto)
	})

	return {
		createBalanceInvoice,
		isBalanceInvoiceLoading
	}
}


