import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly botApi: AxiosInstance;
    private readonly botToken: string;

    constructor(private readonly configService: ConfigService) {
        this.botToken = this.configService.get<string>("TELEGRAM_BOT_TOKEN") || "";

        this.botApi = axios.create({
            baseURL: `https://api.telegram.org/bot${this.botToken}`,
            timeout: 10000,
        });
    }

    async getBotInfo(): Promise<any> {
        try {
            const response = await this.botApi.get("getMe");
            return response.data.result;
        } catch (error: any) {
            this.logger.error(`Failed to get bot info: ${error.message}`);
            throw error;
        }
    }
}

