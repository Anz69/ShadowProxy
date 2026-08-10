# SPRINT 4 — Аренда IPv4 / IPv6 на время (ТЗ п.5)

> Биллинг по **IP×период** (не по ГБ), списание с основного баланса. Реализован полный
> цикл аренды поверх модели `RentedIp`. Реальное выделение IP изолировано за провайдер-сеймом,
> т.к. реквизиты пула IP в ТЗ ещё не заданы.

## Что реализовано

**Модель/БД** (заложены в Sprint 3, миграция `migrations/2026-06-26-…sql`):
`RentedIp` + enum `IpFamily (IPV4|IPV6)`, `RentedIpStatus (ACTIVE|EXPIRED|REPLACED)`.

**`backend/src/rented-ip/`**
- `rented-ip.provider.ts` — сейм выделения/освобождения IP у апстрима. Гейт по флагу
  `RENTED_IP_UPSTREAM_ENABLED`. Пока выключено — `errors.rented_ip_not_available`
  (не выдаём нерабочие IP). TODO: подключить реальный пул, когда будут реквизиты.
- `rented-ip.service.ts`:
  - `rent` — биллинг IP×период, проверка/списание баланса, выделение, запись (в транзакции;
    выделение ДО списания, откат `release` при ошибке).
  - `listForUser`, `exportText` (.txt со списком активных IP).
  - `replace` — замена IP при бане с лимитом (`rented_ip_pricing.replaceLimit`).
  - `setAutoRenew`.
  - Крон `notifyExpiringSoon` (каждые 6ч) — уведомление за 3 дня (`notified3d`).
  - Крон `processExpirations` (каждый час) — автопродление (если хватает баланса) либо
    `EXPIRED` + освобождение IP + уведомление.
- `rented-ip.controller.ts` — `GET /rented-ip`, `POST /rented-ip/rent`,
  `GET /rented-ip/export`, `PATCH /rented-ip/:id/replace`, `PATCH /rented-ip/:id/auto-renew`.
- `dtos/rent-ip.dto.ts` — валидация (family IPV4|IPV6, quantity 1–100, periodDays 1–365).

**Конфиг**
- env `RENTED_IP_UPSTREAM_ENABLED=true` — включить реальное выделение (после интеграции пула).
- settings `rented_ip_pricing` = `{ ipv4, ipv6, periodDays, replaceLimit }`
  (дефолт `{3, 1, 30, 3}`), редактируется как прочие тарификации.

**i18n** — backend `errors.rented_ip_*`, `validation.UNKNOWN_IP_FAMILY`; фронт `errors.rented_ip_*`.

## Что осталось (когда будут реквизиты пула IP)
- Реальная интеграция `RentedIpProvider.allocate/release` с апстрим-пулом + маппинг
  `upstreamRef` на порт/гейтвей, чтобы выданный IP реально проксировал.
- Фронт: страница аренды (выбор family/кол-во/срок/autoRenew, список, кнопки .txt/замена/продление).
- Метрики/тесты на живом окружении.
