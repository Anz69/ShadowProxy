# Production release runbook

Все команды выполняются из `backend` внутри backend-контейнера либо на хосте с тем же `.env` и доступом к PostgreSQL/Mango. Обычный деплой больше не запускает provider data-миграции автоматически.

## 1. Резервная копия

Перед изменением Mango сохранить дамп PostgreSQL и экспорт списка всех Mango-субаккаунтов. Визуальные балансы сайта скрипт не изменяет.

## 2. Mango: аудит и обнуление

```bash
node scripts/mango-traffic-reconcile.js audit
node scripts/mango-traffic-reconcile.js zero --usernames-file=/secure/mango-usernames.txt
node scripts/mango-traffic-reconcile.js zero --execute --confirm=MANGO_ZERO --usernames-file=/secure/mango-usernames.txt
```

Файл содержит по одному Mango username в строке и нужен, чтобы охватить субаккаунты, которые не связаны с пользователями в БД сайта. Без него скрипт обрабатывает все связанные аккаунты из `users.premium_username`. После каждой записи выполняется повторный `/user_info`; ошибка проверки даёт ненулевой exit code.

## 3. Деплой и миграции Prisma

```bash
docker compose up -d --build
docker compose exec -T backend npx prisma migrate status
```

## 4. Mango: восстановление по балансам сайта

```bash
docker compose exec -T backend node scripts/mango-traffic-reconcile.js restore
docker compose exec -T backend node scripts/mango-traffic-reconcile.js restore --execute --confirm=MANGO_RESTORE
docker compose exec -T backend node scripts/mango-traffic-reconcile.js audit
```

`restore` доводит `last_flow` до `premiumTrafficLeft` дельтой. Он идемпотентен и не меняет баланс пользователя на сайте.

## 5. Gateway: выбрать одну рабочую ноду

```bash
docker compose exec -T backend node scripts/gateway-audit.js
docker compose exec -T backend node scripts/gateway-audit.js --execute --keep=WORKING_IP
```

Скрипт проверяет TCP 10000, control-plane 808, реальный HTTPS-запрос через зарегистрированный ACTIVE-прокси и фактическое увеличение `trafficUsed` после отчёта агента. Переключение оставляет одну ноду `ACTIVE`, остальные переводит в `OFFLINE`; записи и действующие прокси не удаляются.

## 6. Режим релиза

```dotenv
USE_NODE_GATEWAY=true
MANGO_MODE=gateway
ENABLE_MANGO_SYNC=false
```

После привязки DNS добавить без протокола и порта:

```dotenv
PROXY_PUBLIC_HOST=proxy.example.com
```

Control-plane продолжит использовать IP из `proxy_servers`, а пользователям при новой генерации будет возвращаться домен.

## 7. Smoke-check

Проверить `/`, `/dashboard`, `/balance`, `/admin/promos`, `/admin/stats`, `/support`; выполнить одну тестовую покупку/промокод и по одному живому прокси каждого продаваемого типа. После этого проверить backend/nginx логи и health контейнеров.
