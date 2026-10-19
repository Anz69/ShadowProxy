import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { createHmac, timingSafeEqual } from "crypto";
import { CreateInvoiceDto } from "../dtos/create-invoice.dto";
import { LoggerService } from "../../../logger/logger.service";
import { AvailableAssets } from "../../types/available-assets.type";
import { XRocketInvoiceCreateRequest, XRocketInvoiceType } from "../types/xrocket/xrocket-invoice.type";

/**
 * xRocket Pay API v1 (Telegram-бот @xRocket). Токен приложения — Bearer; инвойс
 * создаётся с clientInvoiceId = наш paymentId, оплата в Telegram или по web-ссылке.
 * Вебхуки подписаны отдельным webhook secret приложения (не API-токеном).
 */
@Injectable()
export class XRocketProvider {
    private readonly api: AxiosInstance;

    /** Наши ассеты → коды валют xRocket (/api/v1/currencies). TON и LTC там недоступны. */
    static readonly CURRENCY_BY_ASSET: Partial<Record<AvailableAssets, string>> = {
        USDT: "USDT",
        BTC: "BTC",
        ETH: "ETH",
        BNB: "BNB",
        TRX: "TRX",
        USDC: "USDC",
    };

    /** Допуск по времени подписи вебхука (рекомендация xRocket — 5 минут). */
    static readonly SIGNATURE_TOLERANCE_MS = 300_000;

    static supportsAsset(asset: string): boolean {
        return asset in XRocketProvider.CURRENCY_BY_ASSET;
    }

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: LoggerService,
    ) {
        this.api = axios.create({
            baseURL: configService.get<string>("XROCKET_BASE_URL") || "https://pay.api.xrocket.exchange",
            timeout: 15000,
            headers: { Authorization: `Bearer ${configService.getOrThrow<string>("XROCKET_API_KEY")}` },
        });
    }

    async createInvoice(dto: CreateInvoiceDto) {
        const currency = XRocketProvider.CURRENCY_BY_ASSET[dto.asset];
        if (!currency) throw new BadRequestException("errors.asset_not_supported");

        const host = this.configService.getOrThrow<string>("HOST");
        const lifetimeSec = Number(this.configService.getOrThrow<number>("PAYMENT_LIFETIME")) || 3600;
        try {
            const res = await this.api.post<XRocketInvoiceType, AxiosResponse<XRocketInvoiceType>, XRocketInvoiceCreateRequest>("/api/v1/invoices", {
                priceAmount: dto.amount,
                priceCurrency: currency,
                payCurrencies: [currency],
                numPayments: 1,
                clientInvoiceId: dto.paymentId,
                description: dto.description,
                expiresIn: lifetimeSec * 1000,
                callback: { payload: { paymentId: dto.paymentId } },
                url: { successUrl: `${host}/dashboard`, cancelUrl: `${host}/balance` },
            });
            const invoice = res.data;
            const link = invoice?.links?.webLink || invoice?.links?.telegramBotLink;
            if (!link) throw new Error(`xRocket invoice without link: ${JSON.stringify(res.data).slice(0, 300)}`);
            return { pay_url: link, id: invoice.id };
        } catch (e: unknown) {
            const detail = axios.isAxiosError(e) ? JSON.stringify(e.response?.data).slice(0, 300) : "";
            await this.logger.error(`Ошибка при создании платежа xRocket: ${String(e)} ${detail}`, undefined, e && typeof e === "object" ? e : undefined);
            throw new InternalServerErrorException("errors.payment_provider_server_error");
        }
    }

    /** Оплаченные инвойсы (новые первыми) — страховка на случай, если вебхук не дошёл. */
    async getPaidInvoices(limit = 100): Promise<XRocketInvoiceType[]> {
        try {
            const res = await this.api.get<{ items: XRocketInvoiceType[] }>("/api/v1/invoices", { params: { status: "paid", limit } });
            return res.data?.items ?? [];
        } catch (e: unknown) {
            await this.logger.error(`xRocket getInvoices: ${String(e)}`);
            return [];
        }
    }

    async getInvoiceByPaymentId(paymentId: string): Promise<XRocketInvoiceType | null> {
        try {
            const res = await this.api.get<XRocketInvoiceType>("/api/v1/invoice", { params: { clientInvoiceId: paymentId } });
            return res.data ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Signature = hex(HMAC-SHA256(`${Signature-Timestamp}.${rawBody}`, XROCKET_WEBHOOK_SECRET)).
     * Считаем по сырым байтам тела: пересериализованный JSON подпись не пройдёт.
     */
    verifyWebhookSignature(
        rawBody: Buffer | string | undefined,
        headers: { signature?: string; version?: string; timestamp?: string },
        now = Date.now(),
    ): boolean {
        const secret = (this.configService.get<string>("XROCKET_WEBHOOK_SECRET") || "").trim();
        if (!secret || !rawBody) return false;
        const { signature, version, timestamp } = headers;
        if (version !== "v1") return false;
        if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
        if (typeof timestamp !== "string" || !/^\d{10,16}$/.test(timestamp)) return false;
        if (Math.abs(now - Number(timestamp)) > XRocketProvider.SIGNATURE_TOLERANCE_MS) return false;
        const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
        const expected = createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body])).digest("hex");
        return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    }
}
