/** xRocket Pay API v1 (https://pay.api.xrocket.exchange, Bearer-токен приложения). */
export type XRocketInvoiceStatus = "active" | "paid" | "partially_paid" | "expired" | "cancelled" | (string & {});

export type XRocketInvoiceType = {
    id: string;
    priceAmount?: string;
    minPayment?: string;
    priceCurrency: string;
    payCurrencies?: string[];
    /** Наш paymentId — по нему связываем инвойс с платежом. */
    clientInvoiceId?: string;
    description?: string;
    expiresIn?: number;
    createdAt: string;
    expiresAt?: string | null;
    status: XRocketInvoiceStatus;
    callback?: { callbackUrl?: string; payload?: Record<string, unknown> };
    url?: { successUrl?: string; cancelUrl?: string };
    links: { telegramBotLink: string; telegramMiniAppLink?: string; webLink?: string };
};

export type XRocketInvoiceCreateRequest = {
    priceAmount: string;
    priceCurrency: string;
    payCurrencies?: string[];
    numPayments?: number;
    clientInvoiceId: string;
    description?: string;
    /** Миллисекунды; 0 — без срока. */
    expiresIn?: number;
    callback?: { callbackUrl?: string; payload?: Record<string, unknown> };
    url?: { successUrl?: string; cancelUrl?: string };
};

export type XRocketPayment = {
    id?: string;
    status: "pending" | "paid" | "expired" | "failed" | "cancelled" | (string & {});
    finalizedAt?: string | null;
    payAmount: string;
    payCurrency: string;
    receiveAmount: string;
    receiveCurrency: string;
};

/**
 * Вебхук: заголовки Signature / Signature-Version (v1) / Signature-Timestamp (мс);
 * подпись = hex(HMAC-SHA256(`${timestamp}.${rawBody}`, webhookSecret)).
 */
export type XRocketWebhookData = {
    id: string;
    timestamp: string;
    type: "invoice" | (string & {});
    data: {
        event: "invoice_status_changed" | "payment_status_changed" | (string & {});
        invoice: XRocketInvoiceType;
        payment?: XRocketPayment;
    };
};
