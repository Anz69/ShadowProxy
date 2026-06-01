# Operations Guide

## Feature flags (backend env)

Все флаги читаются через `ConfigService`. Дефолты применяются если переменная не задана.

| Переменная | Дефолт | Назначение |
|---|---|---|
| `USE_NODE_GATEWAY` | `false` | Если `true` — выпуск/учёт прокси идёт через node-gateway (legacy). Если `false` — прямой режим: backend сам напрямую общается с API провайдеров (Mango, ProxyEmpire). По умолчанию задействован прямой режим. |
| `ENABLE_MANGO_SYNC` | `true` (любое значение кроме пустого) | Минутный cron `MangoProxyProvider.updateUserBalances()` синхронизирует Mango.last_flow → DB.premiumTrafficLeft, пишет USAGE-логи и traffic_logs. Отключение — установить пустое значение. |
| `ENABLE_PROXYEMPIRE_USAGE_SYNC` | `true` (если не `"false"`) | Минутный cron `ProxyService.syncProxyEmpireUsage()` для PE residential/mobile. |
| `ENABLE_LEGACY_MOBILE_GB` | `false` | Открывает доступ к старому endpoint `POST /api/proxy/issue/mobile-gb` (FlashProxy/LTE-Socks). По умолчанию — 410 Gone. Включать только для аварийного отката. После миграции `20260514150000_migrate_mobilegb_to_mobile` баланс юзеров уже в `mobile_traffic_left` (ProxyEmpire). |

## DNS-резолв провайдеров

`MangoProxyProvider` и `ProxyEmpireProvider` резолвят `p1.mangoproxy.com` / `v2.proxyempire.io` в IP при старте и **раз в час по cron'у** (`refreshResolvedHost`). При смене A-записи провайдера контейнер сам подхватит новый IP без рестарта — будет лог `host changed: <old> → <new>`.

Если нужно ручное обновление: `docker compose restart backend`.

## Откат на node-gateway

Если прямой режим даёт сбой и нужно временно вернуться на legacy:

```bash
echo "USE_NODE_GATEWAY=true" >> /home/shaproxy/ShadowProxy/backend/.env
docker compose restart backend
```

После этого:
- генерация прокси возвращается к маршруту через `node-gateway`
- учёт списания снова идёт через `proxy-node.controller.ts`
- крон-синки PE/Mango продолжают работать поверх (двойной учёт не возникает, т.к. в gateway-режиме они тоже пишут в `premiumTrafficLeft`)

## Миграционные скрипты

### `backend/scripts/migrate-resident-to-balance.js`

Возврат legacy `residentTrafficLeft` (Luna) на денежный баланс юзера. Цена — `settings.proxy_tariffications.resident_premium`. Запуск:

```bash
docker exec shadowproxy-backend-1 node scripts/migrate-resident-to-balance.js
```

Идемпотентен: повторный запуск ничего не делает, т.к. поле уже = `"0"`.

### `backend/scripts/luna-to-mango-migrate.js` (auto, через entrypoint)

Запускается автоматически из `migrate-deploy.js`. Можно вызвать вручную (например, чтобы добить недомигрировавшийся аккаунт):

```bash
docker exec shadowproxy-backend-1 node scripts/luna-to-mango-migrate.js
```

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
