import { HeleketInvoiceStatus } from "./heleket-invoice-status.type";
import { AvailableAssets } from "../../../types/available-assets.type";

export type HeleketWebhookData = {
    type: "payment" | "wallet";
    uuid: string;
    order_id: string;
    amount: string;
    payment_amount: string;
    payment_amount_usd: string;
    merchant_amount: string;
    commission: string;
    is_final: boolean;
    status: HeleketInvoiceStatus;
    from: string;
    wallet_address_uuid?: string | null;
    network: string;
    currency: AvailableAssets;
    payer_currency: AvailableAssets;
    payer_amount: string;
    payer_amount_exchange_rate: string;
    additional_data?: string | null;
    transfer_id?: string | null;
    txid: string;
    sign: string;
};
