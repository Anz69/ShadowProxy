import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { CreateInvoiceDto } from "../dtos/create-invoice.dto";
import { LoggerService } from "../../../logger/logger.service";
import { AvailableAssets } from "../../types/available-assets.type";
import { XRocketInvoiceInputType, XRocketInvoiceType, XRocketWebhookData } from "../types/xrocket/xrocket-invoice.type";

/**
 * xRocket Pay (Telegram-бот @xRocket). Инвойс создаётся в выбранной валюте,
 * оплата — внутри Telegram; вебхук invoicePay подписан HMAC-SHA256 ключом
 * sha256(api-token) — тот же приём, что у CryptoBot.
 */
@Injectable()
export class XRocketProvider {
    private readonly api: AxiosInstance;

    /** Наши ассеты → ID валюты xRocket (/currencies/available). LTC у xRocket нет. */
    static readonly CURRENCY_BY_ASSET: Partial<Record<AvailableAssets, string>> = {
        USDT: "USDT",
        TON: "TONCOIN",
        BTC: "BTC",
        ETH: "ETH",
        BNB: "BNB",
        TRX: "TRX",
        USDC: "USDC",
    };

    static supportsAsset(asset: string): boolean {
        return asset in XRocketProvider.CURRENCY_BY_ASSET;
    }

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: LoggerService,
    ) {
        this.api = axios.create({
            baseURL: configService.get<string>("XROCKET_BASE_URL") || "https://pay.xrocket.exchange",
            timeout: 15000,
            headers: { "Rocket-Pay-Key": configService.getOrThrow<string>("XROCKET_API_KEY") },
        });
    }

    async createInvoice(dto: CreateInvoiceDto) {
        const currency = XRocketProvider.CURRENCY_BY_ASSET[dto.asset];
        if (!currency) throw new BadRequestException("errors.asset_not_supported");

        const host = this.configService.getOrThrow<string>("HOST");
        try {
            const res = await this.api.post<
                { success: boolean; data: XRocketInvoiceType },
                AxiosResponse<{ success: boolean; data: XRocketInvoiceType }>,
                XRocketInvoiceInputType
            >("/tg-invoices", {
                amount: Number(dto.amount),
                numPayments: 1,
                currency,
                description: dto.description,
                callbackUrl: `${host}/dashboard`,
                payload: JSON.stringify({ paymentId: dto.paymentId }),
                expiredIn: Math.min(86400, Number(this.configService.getOrThrow<number>("PAYMENT_LIFETIME")) || 3600),
            });
            if (!res.data?.success || !res.data.data?.link) {
                throw new Error(`xRocket invoice without link: ${JSON.stringify(res.data).slice(0, 300)}`);
            }
            return { pay_url: res.data.data.link, id: res.data.data.id };
        } catch (e: unknown) {
            await this.logger.error(`Ошибка при создании платежа xRocket: ${String(e)}`, undefined, e && typeof e === "object" ? e : undefined);
            throw new InternalServerErrorException("errors.payment_provider_server_error");
        }
    }

    /** Оплаченные инвойсы из последних созданных — страховка на случай, если вебхук не дошёл. */
    async getPaidInvoices(limit = 100): Promise<XRocketInvoiceType[]> {
        try {
            const res = await this.api.get<{ success: boolean; data: { results: XRocketInvoiceType[] } }>("/tg-invoices", { params: { limit, offset: 0 } });
            return (res.data?.data?.results ?? []).filter((i) => i.status === "paid");
        } catch (e: unknown) {
            await this.logger.error(`xRocket getInvoices: ${String(e)}`);
            return [];
        }
    }

    async getInvoice(id: number | string): Promise<XRocketInvoiceType | null> {
        try {
            const res = await this.api.get<{ success: boolean; data: XRocketInvoiceType }>(`/tg-invoices/${id}`);
            return res.data?.data ?? null;
        } catch {
            return null;
        }
    }

    /** rocket-pay-signature = hex(HMAC-SHA256(body, sha256(apiToken))). */
    verifyWebhookSignature(body: XRocketWebhookData, signature: string) {
        if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
        const secret = createHash("sha256").update(this.configService.getOrThrow<string>("XROCKET_API_KEY")).digest();
        const hmac = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
        return timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(signature, "hex"));
    }
}
