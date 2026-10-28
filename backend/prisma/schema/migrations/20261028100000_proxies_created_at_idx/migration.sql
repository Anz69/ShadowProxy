-- Статистика админки группирует прокси по времени создания (≈500k строк).
CREATE INDEX IF NOT EXISTS "proxies_created_at_idx" ON "proxies"("created_at");
