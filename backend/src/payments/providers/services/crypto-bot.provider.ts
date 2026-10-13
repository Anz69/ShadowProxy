import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isDev } from "../../../shared/utils/is-dev";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { CryptoBotInvoiceType } from "../types/crypto-bot/crypto-bot-invoice.type";
import { CryptoBotInvoiceInputType } from "../types/crypto-bot/crypto-bot-invoice-input.type";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { CryptoBotWebhookDataType } from "../types/crypto-bot/crypto-bot-webhook-data.type";
import { CreateInvoiceDto } from "../dtos/create-invoice.dto";
import { LoggerService } from "../../../logger/logger.service";

@Injectable()
export class CryptoBotProvider {
    private readonly cryptoBotApi: AxiosInstance;

    constructor(
        private readonly configService: ConfigService,
        private readonly logger: LoggerService,
    ) {
        this.cryptoBotApi = axios.create({
            baseURL: isDev(configService) ? "https://testnet-pay.crypt.bot/api" : "https://pay.crypt.bot/api",
            headers: {
                "Crypto-Pay-API-Token": configService.getOrThrow<string>("CRYPTO_BOT_API_KEY"),
            },
        });
    }

    async createInvoice(dto: CreateInvoiceDto) {
        try {
            const res = await this.cryptoBotApi.post<
                { result: CryptoBotInvoiceType },
                AxiosResponse<{
                    result: CryptoBotInvoiceType;
                }>,
                CryptoBotInvoiceInputType
            >("/createInvoice", {
                currency_type: "crypto",
                amount: dto.amount,
                asset: dto.asset,
                expires_in: this.configService.getOrThrow<number>("PAYMENT_LIFETIME"),
                description: dto.description,
                paid_btn_name: "callback",
                paid_btn_url: `${this.configService.getOrThrow<string>("HOST")}/dashboard`,
                payload: JSON.stringify({
                    paymentId: dto.paymentId,
                }),
            });

            return res.data.result;
        } catch (e: unknown) {
            await this.logger.error(`Ошибка при создании платежа Crypto Bot: ${String(e)}`, undefined, e && typeof e === "object" ? e : undefined);
            throw new InternalServerErrorException("errors.payment_provider_server_error");
        }
    }

    verifyWebhookSignature(body: CryptoBotWebhookDataType, signature: string) {
        if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
        const secret = createHash("sha256").update(this.configService.getOrThrow<string>("CRYPTO_BOT_API_KEY")).digest();
        const checkString = JSON.stringify(body);
        const hmac = createHmac("sha256", secret).update(checkString).digest("hex");
        return timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(signature, "hex"));
    }
}
