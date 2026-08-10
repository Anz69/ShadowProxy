-- Индексы под админ-список пользователей (пагинация/сортировка по дате) и
-- выборки OAuth-аккаунтов юзера (AuthGuard include accounts на каждый запрос).
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users"("created_at");
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts"("user_id");
