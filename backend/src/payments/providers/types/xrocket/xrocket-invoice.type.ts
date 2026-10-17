/** Инвойс xRocket Pay (POST /tg-invoices, GET /tg-invoices/:id). */
export type XRocketInvoiceStatus = "active" | "paid" | "expired";

export type XRocketInvoiceType = {
    id: number;
    amount: number;
    minPayment?: number;
    totalActivations?: number;
    activationsLeft?: number;
    description?: string;
    hiddenMessage?: string;
    payload?: string;
    callbackUrl?: string;
    commentsEnabled?: boolean;
    currency: string;
    created: string;
    paid?: string;
    status: XRocketInvoiceStatus;
    expiredIn?: number;
    /** Ссылка на оплату в боте: https://t.me/xRocket?start=inv_... */
    link: string;
};

export type XRocketInvoiceInputType = {
    amount: number;
    numPayments: number;
    currency: string;
    description?: string;
    hiddenMessage?: string;
    commentsEnabled?: boolean;
    callbackUrl?: string;
    payload?: string;
    expiredIn?: number;
};

export type XRocketPaymentStat = {
    id: string;
    userId?: number;
    paymentNum: number;
    paymentAmount: number;
    paymentAmountReceived: number;
    comment?: string;
    paid: string;
};

/** Тело вебхука invoicePay; подпись в заголовке rocket-pay-signature. */
export type XRocketWebhookData = {
    type: "invoicePay" | "subscriptionPay" | "subscriptionEnd" | "exchangeOrderComplete" | "chequeStatusChange";
    id?: string;
    timestamp: string;
    data: XRocketInvoiceType & { payment?: XRocketPaymentStat };
};
