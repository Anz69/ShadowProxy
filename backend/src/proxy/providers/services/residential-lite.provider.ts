import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Residential Lite (SPRINT-3, ТЗ п.4) — продажа по ГБ, через наш гейтвей. Страны — любые
 * (без ограничения по списку). Порты апстрима нестандартные (6969/9696).
 *
 * Формат upstream-строки (в proxy_username на гейтвей):
 *   BY_REQUEST: {FLASH_RESIDENTIAL_LITE_USERNAME}-country-{ГЕО}
 *
 * Ротация: по официальной доке FlashProxy Residential Lite — rotating-only
 * (docs/products/residential-lite, docs/sessions: «no sticky sessions»). Параметры
 * -time-/-session- Lite не поддерживает — раньше мы их подставляли и получали 407
 * от апстрима. Поэтому rotationTime здесь намеренно игнорируется: прокси всегда
 * ротирует по запросу, как у провайдера.
 */
@Injectable()
export class ResidentialLiteProvider {
    private readonly host: string;
    private readonly portHttp: number;
    private readonly portSocks = 9696; // на будущее (гейтвей ходит по HTTP CONNECT)
    private readonly user: string;
    private readonly pass: string;

    constructor(config: ConfigService) {
        this.host = config.get<string>("FLASH_RESIDENTIAL_LITE_HOST", "lite.flashproxy.io");
        this.portHttp = Number(config.get<string>("FLASH_RESIDENTIAL_LITE_HTTP_PORT", "6969"));
        this.user = config.getOrThrow<string>("FLASH_RESIDENTIAL_LITE_USERNAME");
        this.pass = config.getOrThrow<string>("FLASH_RESIDENTIAL_LITE_PASSWORD");
        if (!Number.isInteger(this.portHttp) || this.portHttp < 1 || this.portHttp > 65535) {
            throw new Error("FLASH_RESIDENTIAL_LITE_HTTP_PORT должен быть корректным TCP-портом");
        }
    }

    /**
     * @param location ISO-2 любой страны.
     * @param rotationTime игнорируется: FlashProxy Residential Lite — rotating-only,
     *        sticky-параметры (-time-/-session-) апстрим отклоняет с 407.
     */
    createProxy(location: string | undefined, rotationTime?: number) {
        void rotationTime;
        const code = (location ?? "").trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) {
            throw new BadRequestException("location обязателен (ISO-2) для Residential Lite");
        }

        const username = `${this.user}-country-${code}`;

        return { host: this.host, port: this.portHttp, username, password: this.pass };
    }
}
