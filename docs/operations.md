# Operations Guide

## Feature flags (backend env)

Все флаги читаются через `ConfigService`. Дефолты применяются если переменная не задана.

| Переменная | Дефолт | Назначение |
|---|---|---|
| `USE_NODE_GATEWAY` | `false` | `true` включает production-маршрут через наш gateway и локальный учёт трафика. `false` оставляет прямой провайдерский маршрут для аварийного отката. |
| `MANGO_MODE` | `api` | `gateway` отключает Mango API для пополнения/синхронизации трафика; баланс учитывается нашей БД и gateway. `api` оставлен для аварийного отката. |
| `ENABLE_MANGO_SYNC` | `false` | Только точное значение `true` включает минутный cron Mango.last_flow → DB.premiumTrafficLeft в API-режиме. В gateway-режиме cron всегда выключен. |
| `PROXY_PUBLIC_HOST` | пусто | Публичный DNS-хост gateway без протокола и порта. В БД остаётся внутренний IP control-plane, пользователю возвращается домен. |
| `ENABLE_PROXYEMPIRE_USAGE_SYNC` | `true` (если не `"false"`) | Минутный cron `ProxyService.syncProxyEmpireUsage()` для PE residential/mobile. |
| `ENABLE_LEGACY_MOBILE_GB` | `false` | Открывает доступ к старому endpoint `POST /api/proxy/issue/mobile-gb` (FlashProxy/LTE-Socks). По умолчанию — 410 Gone. Включать только для аварийного отката. После миграции `20260514150000_migrate_mobilegb_to_mobile` баланс юзеров уже в `mobile_traffic_left` (ProxyEmpire). |

## DNS-резолв провайдеров

`MangoProxyProvider` и `ProxyEmpireProvider` резолвят `p1.mangoproxy.com` / `v2.proxyempire.io` в IP при старте и **раз в час по cron'у** (`refreshResolvedHost`). При смене A-записи провайдера контейнер сам подхватит новый IP без рестарта — будет лог `host changed: <old> → <new>`.

Если нужно ручное обновление: `docker compose restart backend`.

## Production-режим через node-gateway

После проверки gateway включить согласованные флаги одной записью в `backend/.env`:

```bash
echo "USE_NODE_GATEWAY=true" >> /home/shaproxy/ShadowProxy/backend/.env
echo "MANGO_MODE=gateway" >> /home/shaproxy/ShadowProxy/backend/.env
echo "ENABLE_MANGO_SYNC=false" >> /home/shaproxy/ShadowProxy/backend/.env
docker compose restart backend
```

После этого:
- генерация прокси возвращается к маршруту через `node-gateway`
- учёт списания снова идёт через `proxy-node.controller.ts`
- Mango API не участвует в пополнении и синхронизации пользовательского трафика
- локальный баланс и `traffic_logs` остаются единственным источником учёта

## Миграционные скрипты

### `backend/scripts/migrate-resident-to-balance.js`

Возврат legacy `residentTrafficLeft` (Luna) на денежный баланс юзера. Цена — `settings.proxy_tariffications.resident_premium`. Запуск:

```bash
docker exec shadowproxy-backend-1 node scripts/migrate-resident-to-balance.js
```

Идемпотентен: повторный запуск ничего не делает, т.к. поле уже = `"0"`.

### `backend/scripts/luna-to-mango-migrate.js`

Не запускается автоматически из `migrate-deploy.js`: provider data-миграции требуют отдельного dry-run и явного запуска. Ручной вызов старой миграции:

```bash
docker exec shadowproxy-backend-1 node scripts/luna-to-mango-migrate.js
```

Для production-сверки, обнуления и восстановления Mango, а также выбора одной gateway-ноды используйте `docs/production-release/RELEASE-RUNBOOK.md`.

## SSL-сертификаты

Автообновление настроено через `/etc/cron.d/certbot-renew` + `/usr/local/sbin/renew-ssl.sh`. Раз в день проверяет, при <30 днях до истечения — `systemctl stop nginx → certbot renew → systemctl start nginx → docker compose restart frontend`.

Лог: `/var/log/letsencrypt/cron.log`.

Ручной форсированный прогон:
```bash
systemctl stop nginx && certbot renew --force-renewal && systemctl start nginx && docker compose restart frontend
```

## Бэкап БД

Перед мажорными миграциями обязателен `pg_dumpall`:

```bash
docker exec shadowproxy-postgres-1 pg_dumpall -U postgres > /root/db-backup-$(date +%F).sql
```

Restore (на ОСТАНОВЛЕННОМ postgres, в **пустой** volume):

```bash
docker compose stop backend frontend postgres
docker run --rm -v shadowproxy_pgdata:/data alpine sh -c "rm -rf /data/* /data/.[!.]*"
docker compose up -d postgres
sleep 8
docker exec -i shadowproxy-postgres-1 psql -U postgres < /root/db-backup-FOO.sql
```
