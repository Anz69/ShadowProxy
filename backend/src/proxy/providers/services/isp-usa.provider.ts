import { BadRequestException, Injectable } from "@nestjs/common";
import { generateRandomString } from "../../../shared/utils/generate-random-string";

/**
 * ISP USA (SPRINT-2, ТЗ п.3) — простейший новый тип: один апстрим, фикс. страна US,
 * продажа по ГБ, ротация BY_REQUEST / BY_TIME (1–1440 мин). Идёт через наш гейтвей:
 * провайдер собирает ТОЛЬКО upstream-строку (host/port/username/password апстрима),
 * клиентские креды и serverHost навешивает proxy.service (как у MOBILE_GB/IPV6_GB).
 *
 * Формат upstream-строки (кладётся в proxy_username на гейтвей):
 *   BY_REQUEST: w8z673e2dx-country-US
 *   BY_TIME:    w8z673e2dx-country-US-time-{МИН}-session-{SESSION_ID}
 */
@Injectable()
export class IspUsaProvider {
    private readonly host = "beta.flashproxy.io";
    private readonly portHttp = 30;
    // SOCKS5-порт апстрима (31) — оставлен на будущее; сейчас гейтвей ходит по HTTP CONNECT.
    private readonly portSocks = 31;
    private readonly user = "w8z673e2dx";
    private readonly pass = "m3tv7xgdcw";

    /**
     * @param rotationTime — интервал ротации в минутах (1–1440). Не указан → ротация по запросу.
     */
    createProxy(rotationTime?: number) {
        let username = `${this.user}-country-US`;

        if (rotationTime !== undefined && rotationTime !== null) {
            if (rotationTime < 1 || rotationTime > 1440) {
                throw new BadRequestException("validation.rotation_max_1440");
            }
            username += `-time-${rotationTime}-session-${generateRandomString(8)}`;
        }

        return {
            host: this.host,
            port: this.portHttp,
            username,
            password: this.pass,
        };
    }
}
