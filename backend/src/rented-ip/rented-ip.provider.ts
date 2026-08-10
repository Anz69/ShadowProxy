import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type AllocatedIp = { ip: string; upstreamRef: string };

/**
 * SPRINT-4 (ТЗ п.5) — выделение арендных IPv4/IPv6 у апстрима.
 *
 * Реквизиты пула IP в ТЗ ещё не заданы (в отличие от ISP-типов, где есть host/user/pass),
 * поэтому реальное выделение изолировано здесь, за провайдер-сеймом. Вся остальная логика
 * аренды (биллинг по IP×период, автопродление, уведомление за 3 дня, выгрузка .txt, замена
 * с лимитом, истечение по крону) работает поверх этого интерфейса.
 *
 * Включается флагом RENTED_IP_UPSTREAM_ENABLED=true. Пока выключено — аренда отдаёт понятную
 * ошибку (errors.rented_ip_not_available), а не выдаёт нерабочие IP.
 */
@Injectable()
export class RentedIpProvider {
    constructor(private readonly config: ConfigService) {}

    isEnabled(): boolean {
        return this.config.get<string>("RENTED_IP_UPSTREAM_ENABLED") === "true";
    }

    /**
     * Выделить `count` IP указанного семейства. Реальная интеграция с апстрим-пулом
     * подключается здесь. Сейчас — гейт по флагу (не выдаём фейковые IP).
     */
    async allocate(family: "IPV4" | "IPV6", count: number): Promise<AllocatedIp[]> {
        void family;
        void count;
        // TODO(sprint-4): при RENTED_IP_UPSTREAM_ENABLED вызвать реальный апстрим-пул
        // IPv4/IPv6 и вернуть [{ ip, upstreamRef }, …] длиной count для family.
        throw new ServiceUnavailableException("errors.rented_ip_not_available");
    }

    /** Освободить IP у апстрима (при истечении/замене). No-op до интеграции. */
    async release(upstreamRef: string | null): Promise<void> {
        void upstreamRef;
        // TODO(sprint-4): реальный вызов освобождения IP у апстрима.
    }
}
