import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import axios, { AxiosInstance, AxiosResponse, isAxiosError } from "axios";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "crypto";
import { HeleketInvoice } from "../types/heleket/heleket-invoice.type";
import { HeleketInvoiceInput } from "../types/heleket/heleket-invoice-input.type";
import { CreateInvoiceDto } from "../dtos/create-invoice.dto";
import { HeleketWebhookData } from "../types/heleket/heleket-webhook.type";

@Injectable()
export class HeleketProvider {
    private readonly heleketApi: AxiosInstance;

    constructor(private readonly configService: ConfigService) {
        this.heleketApi = axios.create({
            baseURL: "https://api.heleket.com/v1",
            headers: {
                merchant: configService.getOrThrow<string>("HELEKET_MERCHANT"),
            },
        });
        this.heleketApi.interceptors.request.use((config) => {
            const sign = this.signBody(config.data);

            config.headers.set("sign", sign);

            return config;
        });
    }

    async createInvoice(dto: CreateInvoiceDto) {
        try {
            const res = await this.heleketApi.post<
                { result: HeleketInvoice },
                AxiosResponse<{
                    result: HeleketInvoice;
                }>,
                HeleketInvoiceInput
            >("/payment", {
                amount: dto.amount,
                currency: dto.asset,
                order_id: dto.paymentId,
                lifetime: this.configService.getOrThrow<number>("PAYMENT_LIFETIME"),
                url_callback: `${this.configService.getOrThrow<string>("HOST")}/api/payments/webhook/heleket`,
                url_return: `${this.configService.getOrThrow<string>("HOST")}/payment`,
                url_success: `${this.configService.getOrThrow<string>("HOST")}/dashboard`,
            });

            return res.data.result;
        } catch (e: unknown) {
            if (isAxiosError(e)) {
                const st = e.response?.status;
                const body = e.response?.data;
                console.error(
                    `[Payments/Heleket] order_id=${dto.paymentId} HTTP ${st ?? "?"} ${e.message}${body !== undefined ? ` ${JSON.stringify(body)}` : ""}`,
                );
                if (st === 422) {
                    throw new BadRequestException("errors.too_small_amount");
                }
            } else {
                console.error(`[Payments/Heleket] order_id=${dto.paymentId} ${String(e)}`);
            }
            throw new InternalServerErrorException("errors.payment_provider_server_error");
        }
    }

    signBody(body: any) {
        const base64 = Buffer.from(JSON.stringify(body)).toString("base64");
        return createHash("md5")
            .update(base64 + this.configService.getOrThrow<string>("HELEKET_API_KEY"))
            .digest("hex");
    }

    verifyWebhookSignature(data: HeleketWebhookData) {
        const { sign, ...body } = data;
        const signedData = this.signBody(body);
        return timingSafeEqual(Buffer.from(signedData), Buffer.from(sign));
    }
}
