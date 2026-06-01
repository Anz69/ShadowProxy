import { useMutation } from "@tanstack/react-query"
import type { PackagePaymentDto, ResidentPaymentDto } from "@/features/payments/types/payment.types"
import { paymentService } from "@/features/payments/serices/payment.service"

export function usePackagePayment() {
	const {mutate: createPackageInvoice, isPending: isPackageInvoiceLoading} = useMutation({
		mutationKey: ["payment"],
		mutationFn: (dto: PackagePaymentDto) => paymentService.createPackageInvoice(dto)
	})

	return {
		createPackageInvoice,
		isPackageInvoiceLoading
	}
}