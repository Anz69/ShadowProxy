import axios, { type AxiosInstance } from "axios"

import type {
	BalancePaymentDto,
	Invoice, IspPaymentDto,
	MetadataType,
	MobilePaymentDto,
	PackagePaymentDto,
	ResidentPaymentDto
} from "@/features/payments/types/payment.types"

import { extractError } from "@/shared/utils/extract-error"

class PaymentService {
	private readonly api: AxiosInstance

	constructor() {
		this.api = axios.create({
			baseURL: `${process.env.NEXT_PUBLIC_BACKEND_URI}/payments`,
			withCredentials: true
		})
	}

	async createMobileInvoice(dto: MobilePaymentDto) {
		try {
			const res = await this.api.post<Invoice<"mobile">>(
				"/invoice/mobile",
				dto
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async createResidentInvoice(dto: ResidentPaymentDto) {
		try {
			const res = await this.api.post<Invoice<"resident">>(
				"/invoice/resident",
				dto
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async createIspInvoice(dto: IspPaymentDto) {
		try {
			const res = await this.api.post<Invoice<"isp">>(
				"/invoice/isp",
				dto
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async createPackageInvoice(dto: PackagePaymentDto) {
		try {
			const res = await this.api.post<Invoice<"package">>(
				"/invoice/package",
				dto
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async createBalanceInvoice(dto: BalancePaymentDto) {
		try {
			const res = await this.api.post<Invoice<"balance">>(
				"/invoice/balance",
				dto
			)
			return res.data
		} catch (e) {
			throw new Error(extractError(e))
		}
	}

	async getAll(): Promise<Invoice[]> {
		try {
			const res = await this.api.get<Invoice<MetadataType>[]>("/my")
			return res.data
		} catch (e) {
			return []
		}
	}
}

export const paymentService = new PaymentService()
