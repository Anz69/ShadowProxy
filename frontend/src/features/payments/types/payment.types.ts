export type AvailableAssets =
	| "USDT"
	| "TON"
	| "BTC"
	| "ETH"
	| "LTC"
	| "BNB"
	| "TRX"
	| "USDC"

export type Merchant = "CRYPTO_BOT" | "HELEKET" | "BALANCE" | "REFERRAL_BALANCE"

type BasePaymentDto = {
	asset: AvailableAssets
	merchant: Merchant
}

export type MobilePaymentDto = BasePaymentDto & {
	planId: string
	rentTime: number
	userPackageId?: string // ID существующего UserPackage для пополнения времени
}

export type ResidentPaymentDto = BasePaymentDto & {
	tariff: ResidentTariff
	traffic: number
}

export type IspPaymentDto = BasePaymentDto & {
	quantity: number
}

export type PackagePaymentDto = BasePaymentDto & {
	package: string
	asset: AvailableAssets
	merchant: Merchant
}

export type BalancePaymentDto = BasePaymentDto & {
	amount: number
}

export type Invoice<T extends MetadataType = MetadataType> = {
	id: string
	amount: string
	amountUsd: string
	asset: AvailableAssets
	paymentUrl: string | null
	provider: Merchant
	status: InvoiceStatus
	metadata: {
		contents: InvoiceMetadata<T>[]
	}
	createdAt: string
	updatedAt: string
	userId: string
	userPackageId?: string | null
}

export type InvoiceMetadata<T extends MetadataType = MetadataType> =
	T extends "mobile"
		? {
				type: "mobile"
				plan: string
				rentTime: number
				userPackageId?: string
			}
		: T extends "resident"
			? {
					type: "resident"
					tariff: ResidentTariff
					traffic: number
				}
			: T extends "package"
				? {
						type: "package"
						packageId: string
					}
				: T extends "isp"
					? {
							type: "isp"
							quantity: number
						}
					: T extends "balance"
						? {
								type: "balance"
								amount: number
							}
						: never

export type MetadataType = "mobile" | "resident" | "package" | "isp" | "balance"

export type ResidentTariff = "RESIDENT" | "RESIDENT_PREMIUM" | "MOBILE_GB" | "IPV6_GB" | "PREMIUM_RESIDENTIAL" | "MOBILE" | "ISP_USA" | "ISP_EU" | "RESIDENTIAL_LITE"

export type InvoiceStatus = "WAITING" | "PAID" | "CANCELLED"

export type ExchangeRates = {
	TON: number
	BTC: number
	ETH: number
	LTC: number
	BNB: number
	TRX: number
}
