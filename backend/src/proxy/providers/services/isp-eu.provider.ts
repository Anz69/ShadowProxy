import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateRandomString } from "../../../shared/utils/generate-random-string";

/**
 * ISP NL — продажа по ГБ через наш гейтвей. Публично доступно только гео NL.
 * Тип ISP_EU оставлен в БД/API ради обратной совместимости существующих пакетов.
 *
 * Формат upstream-строки (в proxy_username на гейтвей):
 *   BY_REQUEST: gedfdvfwf8-country-DE            (или -country-DE,FR,NL)
 *   BY_TIME:    gedfdvfwf8-country-DE,FR,NL-time-{МИН}-session-{SESSION_ID}
 */
@Injectable()
export class IspEuProvider {
    private readonly host: string;
    private readonly portHttp: number;
    private readonly portSocks = 31; // на будущее (гейтвей ходит по HTTP CONNECT)
    private readonly user: string;
    private readonly pass: string;
    private readonly allowed = ["NL"];

    constructor(config: ConfigService) {
        this.host = config.get<string>("FLASH_ISP_EU_HOST", "eu-isp.flashproxy.io");
        this.portHttp = Number(config.get<string>("FLASH_ISP_EU_HTTP_PORT", "30"));
        this.user = config.getOrThrow<string>("FLASH_ISP_EU_USERNAME");
        this.pass = config.getOrThrow<string>("FLASH_ISP_EU_PASSWORD");
        if (!Number.isInteger(this.portHttp) || this.portHttp < 1 || this.portHttp > 65535) {
            throw new Error("FLASH_ISP_EU_HTTP_PORT должен быть корректным TCP-портом");
        }
    }

    /** @param location ISO-2; в текущем продуктовом режиме допустим только NL. */
    createProxy(location: string | undefined, rotationTime?: number) {
        const codes = (location ?? "")
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);

        if (!codes.length) {
            throw new BadRequestException("location обязателен для ISP NL");
        }
        for (const c of codes) {
            if (!this.allowed.includes(c)) {
                throw new BadRequestException(`Страна ${c} недоступна для ISP NL`);
            }
        }

        let username = `${this.user}-country-${codes.join(",")}`;
        if (rotationTime !== undefined && rotationTime !== null) {
            if (rotationTime < 1 || rotationTime > 1440) {
                throw new BadRequestException("validation.rotation_max_1440");
            }
            username += `-time-${rotationTime}-session-${generateRandomString(8)}`;
        }

        return { host: this.host, port: this.portHttp, username, password: this.pass };
    }

    /** Список стран для UI (мультиселект). */
    getCountries(): string[] {
        return [...this.allowed];
    }
}
