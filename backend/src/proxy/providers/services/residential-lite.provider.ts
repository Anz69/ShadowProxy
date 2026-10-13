import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateRandomString } from "../../../shared/utils/generate-random-string";

/**
 * Residential Lite (SPRINT-3, ТЗ п.4) — продажа по ГБ, через наш гейтвей. Страны — любые
 * (без ограничения по списку). Порты апстрима нестандартные (6969/9696).
 *
 * Формат upstream-строки (в proxy_username на гейтвей):
 *   BY_REQUEST: {FLASH_RESIDENTIAL_LITE_USERNAME}-country-{ГЕО}
 *   BY_TIME:    {FLASH_RESIDENTIAL_LITE_USERNAME}-country-{ГЕО}-time-{МИН}-session-{SESSION_ID}
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

    /** @param location ISO-2 любой страны. */
    createProxy(location: string | undefined, rotationTime?: number) {
        const code = (location ?? "").trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(code)) {
            throw new BadRequestException("location обязателен (ISO-2) для Residential Lite");
        }

        let username = `${this.user}-country-${code}`;
        if (rotationTime !== undefined && rotationTime !== null) {
            if (rotationTime < 1 || rotationTime > 1440) {
                throw new BadRequestException("validation.rotation_max_1440");
            }
            username += `-time-${rotationTime}-session-${generateRandomString(8)}`;
        }

        return { host: this.host, port: this.portHttp, username, password: this.pass };
    }
}
