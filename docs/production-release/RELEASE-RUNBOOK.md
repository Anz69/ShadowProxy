# Production release runbook

Все команды выполняются из корня проекта. Обычный деплой больше не запускает provider data-миграции автоматически. Приватный каталог `release-private/` смонтирован в backend-контейнер как `/secure` и исключён из Git.

## 1. Резервная копия

Перед изменением Mango сохранить дамп PostgreSQL и экспорт списка всех Mango-субаккаунтов. Визуальные балансы сайта скрипт не изменяет.

```bash
install -d -m 700 release-private
set -a; . ./.env; set +a
docker compose exec -T postgres pg_dump -U "$POSTGRES_USERNAME" -d "$POSTGRES_DATABASE" -Fc > "release-private/pre-release-$(date -u +%Y%m%dT%H%M%SZ).dump"
install -m 600 /path/from/mango/full-usernames-export.txt release-private/mango-usernames.txt
```

Не продолжать, если дамп пуст, полный экспорт Mango не получен или его количество аккаунтов не сверено с кабинетом Mango.

## 2. Mango: аудит и обнуление

```bash
docker compose exec -T backend node scripts/mango-traffic-reconcile.js audit --timeout-ms=5000 --report-file=/secure/mango-audit-before.json
docker compose exec -T backend node scripts/mango-traffic-reconcile.js zero --usernames-file=/secure/mango-usernames.txt --report-file=/secure/mango-zero-dry-run.json
docker compose exec -T backend node scripts/mango-traffic-reconcile.js zero --execute --confirm=MANGO_ZERO --confirm-scope=ALL_MANGO_ACCOUNTS --usernames-file=/secure/mango-usernames.txt --report-file=/secure/mango-zero-result.json
```

Файл содержит по одному Mango username в строке и должен быть полным экспортом Mango, включая аккаунты, которые не связаны с пользователями в БД сайта. Реальное обнуление без полного manifest и отдельного подтверждения scope запрещено. До первого изменения скрипт читает `last_flow` всех целей; любая ошибка preflight останавливает операцию без частичного обнуления. После каждой записи выполняется повторный `/user_info`, а приватный JSON-журнал создаётся с правами `0600`.

## 3. Деплой и миграции Prisma

```bash
docker compose up -d --build
docker compose exec -T backend npx prisma migrate status
```

## 4. Mango: восстановление по балансам сайта

```bash
docker compose exec -T backend node scripts/mango-traffic-reconcile.js restore
docker compose exec -T backend node scripts/mango-traffic-reconcile.js restore --execute --confirm=MANGO_RESTORE --report-file=/secure/mango-restore-result.json
docker compose exec -T backend node scripts/mango-traffic-reconcile.js audit --timeout-ms=5000 --report-file=/secure/mango-audit-after.json
```

`restore` доводит `last_flow` до `premiumTrafficLeft` дельтой. Он идемпотентен и не меняет баланс пользователя на сайте.

## 5. Gateway: выбрать одну рабочую ноду

```bash
docker compose exec -T backend node scripts/gateway-audit.js --report-file=/secure/gateway-audit.json
docker compose exec -T backend node scripts/gateway-audit.js --execute --confirm=GATEWAY_SINGLE_NODE --keep=WORKING_IP --report-file=/secure/gateway-selection.json
```

Скрипт проверяет TCP 10000, авторизованный `/health` control-plane, реальный HTTPS-запрос через зарегистрированный ACTIVE-прокси и фактическое увеличение `trafficUsed` после отчёта агента. Переключение требует отдельного подтверждения, сохраняет приватный журнал, оставляет одну ноду `ACTIVE`, остальные переводит в `OFFLINE`; записи и действующие прокси не удаляются.

## 6. Режим релиза

```dotenv
USE_NODE_GATEWAY=true
MANGO_MODE=gateway
ENABLE_MANGO_SYNC=false
FLASH_ISP_EU_USERNAME=<secret>
FLASH_ISP_EU_PASSWORD=<secret>
FLASH_ISP_USA_USERNAME=<secret>
FLASH_ISP_USA_PASSWORD=<secret>
FLASH_RESIDENTIAL_LITE_USERNAME=<secret>
FLASH_RESIDENTIAL_LITE_PASSWORD=<secret>
```

После привязки DNS добавить без протокола и порта:

```dotenv
PROXY_PUBLIC_HOST=proxy.example.com
```

Control-plane продолжит использовать IP из `proxy_servers`, а пользователям при новой генерации будет возвращаться домен.

## 7. Smoke-check

```bash
docker compose exec -T backend node scripts/gateway-provider-smoke.js
```

Команда по умолчанию временно регистрирует отдельные QA-логины, проверяет ISP NL, ISP USA и Residential Lite через ACTIVE gateway скачиванием по 100 KB и всегда блокирует QA-логины после теста. Существующие пользовательские Mango-прокси по умолчанию не используются.

Для отдельного Mango smoke добавьте `--include-mango`. Этот режим выбирает существующий ACTIVE Mango-прокси из пользовательской БД и расходует около 100 KB его upstream-трафика; запускайте его только при наличии выделенного тестового Mango-прокси. Баланс и пакеты пользователей сайт не изменяет.

Дополнительно проверить `/`, `/dashboard`, `/balance`, `/admin/promos`, `/admin/stats`, `/support`; выполнить одну тестовую покупку/промокод в выделенном QA-аккаунте. После этого проверить backend/nginx логи и health контейнеров.
