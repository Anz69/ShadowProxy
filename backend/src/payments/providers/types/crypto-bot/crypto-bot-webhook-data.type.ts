import { CryptoBotInvoiceType } from "./crypto-bot-invoice.type";

export type CryptoBotWebhookDataType = {
    update_id: number;
    update_type: string | "invoice_paid";
    request_date: string;
    payload: CryptoBotInvoiceType;
};
