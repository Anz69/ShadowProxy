import type { AvailableAssets } from "@/features/payments/types/payment.types"
import type { Merchant } from "@/features/payments/types/payment.types"

/** Ассеты, которых нет у мерчанта (xRocket не принимает LTC). */
export const unsupportedAssetsByMerchant: Partial<Record<Merchant, AvailableAssets[]>> = {
	XROCKET: ["LTC", "TON"]
}

export const assetsForMerchant = (merchant: Merchant) =>
	availableAssets.filter(a => !(unsupportedAssetsByMerchant[merchant] ?? []).includes(a.value as AvailableAssets))

export const availableAssets = [
	{
		label: "USDT",
		value: "USDT"
	},
	{
		label: "TON",
		value: "TON"
	},
	{
		label: "Bitcoin",
		value: "BTC"
	},
	{
		label: "Ethereum",
		value: "ETH"
	},
	{
		label: "Litecoin",
		value: "LTC"
	},
	{
		label: "BNB",
		value: "BNB"
	},
	{
		label: "Tron",
		value: "TRX"
	},
	{
		label: "USDC",
		value: "USDC"
	}
]