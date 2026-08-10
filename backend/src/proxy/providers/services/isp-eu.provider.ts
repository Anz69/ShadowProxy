import { BadRequestException, Injectable } from "@nestjs/common";
import { generateRandomString } from "../../../shared/utils/generate-random-string";

/**
 * ISP EU (SPRINT-3, ТЗ п.2) — продажа по ГБ, через наш гейтвей. Поддерживает МУЛЬТИГЕО:
 * пользователь выбирает одну или несколько стран из списка, в upstream-строке они
 * перечисляются через запятую.
 *
 * Формат upstream-строки (в proxy_username на гейтвей):
 *   BY_REQUEST: gedfdvfwf8-country-DE            (или -country-DE,FR,NL)
 *   BY_TIME:    gedfdvfwf8-country-DE,FR,NL-time-{МИН}-session-{SESSION_ID}
 */
@Injectable()
export class IspEuProvider {
    private readonly host = "eu-isp.flashproxy.io";
    private readonly portHttp = 30;
    private readonly portSocks = 31; // на будущее (гейтвей ходит по HTTP CONNECT)
    private readonly user = "gedfdvfwf8";
    private readonly pass = "o18geslcqi";
    private readonly allowed = ["GB", "CA", "DE", "FR", "AU", "JP", "NL", "IT", "ES"];

    /** @param location ISO-2 одной страны или нескольких через запятую ("DE,FR,NL"). */
    createProxy(location: string | undefined, rotationTime?: number) {
        const codes = (location ?? "")
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);

        if (!codes.length) {
            throw new BadRequestException("location обязателен для ISP EU");
        }
        for (const c of codes) {
            if (!this.allowed.includes(c)) {
                throw new BadRequestException(`Страна ${c} недоступна для ISP EU`);
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
