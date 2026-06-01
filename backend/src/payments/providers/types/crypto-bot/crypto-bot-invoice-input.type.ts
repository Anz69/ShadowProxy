import { AvailableAssets } from "../../../types/available-assets.type";

export type CryptoBotInvoiceInputType = {
    currency_type: string;
    asset: AvailableAssets;
    amount: string;
    description?: string;
    paid_btn_name?: string;
    paid_btn_url?: string;
    payload?: string;
    expires_in: number;
};
