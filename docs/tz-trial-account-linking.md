# ТЗ: Антифрод триала через привязку аккаунтов

## Цель

Триал выдаётся **один раз на реального человека**, а не на email. Идентификатор человека — верифицированный Google или Telegram аккаунт. Один Google/Telegram аккаунт = максимум один использованный триал в системе, даже если он переподвязывается к разным учёткам.

## Контекст (что уже есть)

- `User.trial: DateTime?` — отметка активации триала (`prisma/schema/user.prisma:39`).
- `getTrial()` проверяет только `user.trial !== null` (`backend/src/user/user.service.ts:372-425`).
- OAuth Google: `GoogleProvider` + `/auth/oauth/connect/:provider`, `/auth/oauth/callback/:provider` (`auth.controller.ts:39,79`).
- Telegram: `/auth/telegram` с HMAC-SHA256 валидацией хэша (`auth.service.ts:145-221`).
- `Account` model: `provider`, `providerAccountId @unique`, `userId` (`prisma/schema/account.prisma`).
- Связь User→Account создаётся автоматически при OAuth/Telegram логине.
- Центра уведомлений **нет** — создаётся с нуля.
- Профиль: `frontend/src/features/user/components/UserAccount.tsx` — блока привязанных аккаунтов нет.

---

# Часть 1 — Модель данных и миграции

**Задача:** хранить факт «этот Google/Telegram уже сжёг триал» независимо от того, к какой учётке он сейчас привязан.

### 1.1. Новая таблица `trial_identity`

```prisma
model TrialIdentity {
  id          String   @id @default(uuid(4))
  provider    String   // "GOOGLE" | "TELEGRAM"
  providerKey String   // googleSub / telegramId (стабильный ID провайдера, не email/username)
  usedByUserId String  @map("used_by_user_id")
  usedAt      DateTime @default(now()) @map("used_at")

  @@unique([provider, providerKey])
  @@map("trial_identity")
}
```

`providerKey`:
- Google → `sub` из OAuth-профиля (неизменяемый, не email).
- Telegram → `id` из telegram-auth payload (числовой, неизменяемый).

### 1.2. Миграция бэкфилла

Для всех `User`, у кого `trial IS NOT NULL` и есть связанный `Account` (GOOGLE/TELEGRAM) — создать запись `TrialIdentity` с соответствующим `providerKey`. Идемпотентна (ON CONFLICT DO NOTHING по `@@unique`).

Файл: `backend/prisma/schema/migrations/<ts>_add_trial_identity/migration.sql` + однократный скрипт `backend/scripts/backfill-trial-identity.js` (по образцу `migrate-resident-to-balance.js`).

### Acceptance
- Таблица создана, уникальный индекс `(provider, providerKey)` работает.
- Бэкфилл проставил записи всем, кто уже использовал триал и имеет привязку.
- Повторный запуск скрипта не создаёт дублей.

---

# Часть 2 — Backend: привязка/отвязка аккаунтов

**Задача:** залогиненный юзер может привязать и отвязать Google/Telegram к **текущей** учётке через верифицированный флоу.

### 2.1. Endpoints (`auth.controller.ts`)

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/auth/link/google` | редирект в Google OAuth (state = userId, подписанный) |
| `GET` | `/auth/link/google/callback` | callback: верифицировать, создать `Account(provider=GOOGLE)` для текущего юзера |
| `POST` | `/auth/link/telegram` | body = telegram-auth payload, HMAC-проверка, создать `Account(provider=TELEGRAM)` |
| `DELETE` | `/auth/link/:provider` | отвязать (удалить `Account`), если это не единственный способ входа |

### 2.2. Правила привязки (`auth.service.ts` / новый `account-link.service.ts`)

- Привязка возможна только авторизованному юзеру (`@Authorization()`).
- Верификация обязательна:
  - Google — полный OAuth code-exchange, брать `sub` + `email` из `profile_url`.
  - Telegram — HMAC-SHA256 по bot token, как в существующем `loginWithTelegram` (`auth.service.ts:167-173`), плюс проверка свежести `auth_date` (не старше 24ч → иначе `errors.telegram_auth_expired`).
- `providerAccountId` уникален глобально. Если этот провайдер-аккаунт уже привязан к **другому** `User` → ошибка `errors.account_already_linked` (не перепривязывать молча).
- Нельзя привязать второй аккаунт того же провайдера к одной учётке (1 Google + 1 Telegram максимум).

### 2.3. Правила отвязки

- Запретить отвязку последнего способа входа: если `authMethod` завязан на этот провайдер и нет пароля/другого провайдера → `errors.cannot_unlink_last_auth`.
- Отвязка **не удаляет** `TrialIdentity` — факт использования триала сохраняется навсегда.

### Acceptance
- Привязка Google/Telegram к своей учётке работает только через верифицированный флоу.
- Попытка привязать провайдер-аккаунт, занятый другим юзером → 409 `account_already_linked`.
- Отвязка последнего способа входа заблокирована.
- i18n-ключи добавлены в `backend/src/i18n/ru/errors.json`.

---

# Часть 3 — Backend: антифрод-логика триала

**Задача:** `getTrial()` выдаёт триал только если у юзера есть привязанный верифицированный аккаунт, и этот аккаунт ранее не сжигал триал.

### 3.1. Изменения в `getTrial()` (`user.service.ts:372`)

Порядок проверок (до создания пакета/аккаунта прокси):

1. `user.trial !== null` → `errors.trial_already_received` (как сейчас).
2. Загрузить `Account[]` юзера с `provider IN (GOOGLE, TELEGRAM)`.
   - Нет ни одного → `errors.trial_requires_linked_account` (новый ключ).
3. Для каждого привязанного аккаунта собрать `(provider, providerKey)`.
4. Проверить `TrialIdentity` по этим парам:
   - Если найдена запись с `usedByUserId != userId` → `errors.trial_identity_already_used`.
5. Прохождение всех проверок → в одной транзакции:
   - `user.trial = now()`
   - `TrialIdentity.create()` для **каждой** привязки юзера (ON CONFLICT — пропуск).
   - дальше существующая логика выдачи (`createPackageIfNotExists`, distribute_traffic).

### 3.2. Гонки

`TrialIdentity` пишется в той же транзакции, что и `user.trial`. Уникальный индекс `(provider, providerKey)` — последняя линия защиты от двойной активации при параллельных запросах.

### Acceptance
- Триал без привязки → отказ с понятным кодом.
- Триал с привязкой нового (не использованного) Google/Telegram → выдаётся.
- Привязка ранее «сжёгшего» триал аккаунта к новой учётке → триал не выдаётся.
- Параллельные запросы триала с одним providerKey → ровно одна активация.

---

# Часть 4 — Центр уведомлений (новый модуль)

**Задача:** минимальный персистентный центр уведомлений; первый кейс — «привяжи аккаунт для триала».

### 4.1. Модель

```prisma
model Notification {
  id        String   @id @default(uuid(4))
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // "TRIAL_REQUIRES_LINK" | ...
  title     String
  body      String
  link      String?  // напр. "/profile/settings#linked-accounts"
  readAt    DateTime? @map("read_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, readAt])
  @@map("notifications")
}
```

### 4.2. Backend (`src/notification/`)

- `notification.service.ts`: `create()`, `listForUser(userId)`, `markRead(id, userId)`, `unreadCount(userId)`.
- `notification.controller.ts`:
  - `GET /notifications` — список текущего юзера (пагинация).
  - `GET /notifications/unread-count`
  - `PATCH /notifications/:id/read`
- Триггер: в `getTrial()` при отказе по `trial_requires_linked_account` — `notificationService.create({ type:"TRIAL_REQUIRES_LINK", link:"/profile/settings#linked-accounts", ... })`.

### 4.3. Frontend

- Иконка-колокол в `Header` с бейджем `unread-count` (поллинг 60с через react-query, как сделано для traffic).
- Дропдаун/страница со списком; клик по уведомлению → переход по `link`, `PATCH .../read`.

### Acceptance
- При отказе в триале без привязки в центре уведомлений появляется запись со ссылкой на настройки.
- Бейдж непрочитанных корректно растёт/сбрасывается.
- Уведомления изолированы по `userId`.

---

# Часть 5 — Frontend: привязка в профиле + UX триала

**Задача:** блок «Привязанные аккаунты» в профиле и кнопки привязки на флоу триала.

### 5.1. Блок «Привязанные аккаунты»

Файл: `frontend/src/features/user/components/UserAccount.tsx` (+ новый `LinkedAccounts.tsx`).

- Секция со статусом Google / Telegram: `Привязан (email/username)` либо кнопка `Привязать Google` / `Привязать Telegram`.
- `Привязать Google` → редирект `${BACKEND}/auth/link/google`.
- `Привязать Telegram` → существующий `TelegramLoginWidget` флоу, но POST на `/auth/link/telegram` вместо `/auth/telegram`.
- Кнопка `Отвязать` рядом с привязанным (с подтверждением), скрыта если это последний способ входа.
- Тосты на success/error, инвалидация `getUser` query.

### 5.2. UX триала

- На экране активации триала (`features/trial/components/TrialModal.tsx`): если у юзера нет привязок — вместо кнопки активации показать две кнопки `Привязать Google` / `Привязать Telegram` + текст-пояснение.
- После успешной привязки — повторно дёрнуть активацию.
- Ошибку `trial_identity_already_used` показывать явным текстом: «Этот аккаунт уже использовал пробный период».

### 5.3. i18n

Добавить ключи во все локали (`ru.json`, `en.json`, `zh-CN.json`):
`profile.linkedAccounts.*`, `trial.requiresLink`, `trial.identityUsed`, `notifications.*`.

### Acceptance
- В профиле виден статус привязок, привязка/отвязка работает с верификацией.
- На триале без привязки показываются кнопки привязки, не кнопка активации.
- Все строки локализованы (ru/en/zh-CN), без хардкода.

---

## Сводка по объёму

| Часть | Backend | Frontend | Миграции |
|---|---|---|---|
| 1. Модель данных | — | — | `TrialIdentity` + backfill |
| 2. Привязка аккаунтов | endpoints + link-service | — | — |
| 3. Антифрод триала | `getTrial()` rewrite | — | — |
| 4. Центр уведомлений | `notification` module | колокол + список | `Notification` |
| 5. Профиль + UX | — | `LinkedAccounts`, `TrialModal` | — |

## Ключевые инварианты

1. `providerKey` = неизменяемый ID провайдера (`sub` / telegram `id`), **не** email/username.
2. `TrialIdentity` не удаляется никогда, даже при отвязке аккаунта.
3. Любая привязка только через верифицированный OAuth/HMAC флоу для авторизованного юзера.
4. Один провайдер-аккаунт нельзя привязать к двум учёткам (`providerAccountId` глобально уникален).
