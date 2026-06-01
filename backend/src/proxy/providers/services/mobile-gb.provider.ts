import { generateRandomString } from "../../../shared/utils/generate-random-string";
import { BadRequestException, Injectable } from "@nestjs/common";
import { isMobileGbCountryAllowed } from "../../../shared/constants/mobile-gb-allowed-countries";

@Injectable()
export class MobileGbProvider {
    // Статические учетные данные для MOBILE_GB прокси (аренда телефонов за ГБ)
    private readonly baseUsername = "l1aubf5fmb";
    private readonly password = "x6dii15twv";
    private readonly host = "adam.flashproxy.io";
    private readonly port = 8080;

    /**
     * Создает мобильный прокси за ГБ (аренда телефонов за ГБ)
     * @param country - ISO код страны (2 буквы), только из разрешённого списка MOBILE_GB
     * @param rotationTime - интервал ротации в минутах (от 1 до 120). Если не указан - ротация по запросу
     * @returns объект с данными прокси
     */
    createProxy(country: string, rotationTime?: number) {
        const trimmed = country?.trim() ?? "";
        const isoCode = trimmed.length === 2 ? trimmed.toUpperCase() : "";

        if (!isoCode || !isMobileGbCountryAllowed(isoCode)) {
            throw new BadRequestException("Страна недоступна для мобильных прокси по ГБ");
        }
        
        // Формируем username в зависимости от типа ротации
        let username: string;
        
        if (rotationTime && rotationTime >= 1 && rotationTime <= 120) {
            // Ротация по времени: l1aubf5fmb-country-<ISO>-mobile-true-package-mobile-time-<TIME>-session-<SESSION>
            const sessionId = generateRandomString(8);
            username = `${this.baseUsername}-country-${isoCode}-mobile-true-package-mobile-time-${rotationTime}-session-${sessionId}`;
        } else {
            // Ротация по запросу: l1aubf5fmb-country-<ISO>-mobile-true-package-mobile
            username = `${this.baseUsername}-country-${isoCode}-mobile-true-package-mobile`;
        }
        
        return {
            username,
            password: this.password,
            host: this.host,
            port: this.port,
        };
    }
}

