import { AvailableAssets } from "../../../types/available-assets.type";

export type HeleketInvoiceInput = {
    amount: string;
    currency: AvailableAssets;
    order_id: string;
    network?: string;
    url_return?: string;
    url_success?: string;
    url_callback?: string;
    is_payment_multiple?: boolean;
    lifetime?: number;
    additional_data?: string;
};
