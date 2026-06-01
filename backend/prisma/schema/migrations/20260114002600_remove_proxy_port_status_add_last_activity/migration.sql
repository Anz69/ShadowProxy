-- RemoveProxyPortStatusAddLastActivity
-- Удаляем поле status и enum ProxyPortStatus, добавляем lastActivityAt

-- Сначала добавляем новую колонку lastActivityAt (если её нет)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proxy_ports' AND column_name = 'last_activity_at') THEN
    ALTER TABLE "proxy_ports" ADD COLUMN "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Обновляем lastActivityAt для существующих записей (используем updatedAt или createdAt)
UPDATE "proxy_ports" SET "last_activity_at" = COALESCE("updated_at", "created_at") WHERE "last_activity_at" IS NULL;

-- Удаляем индекс на status, если он существует
DROP INDEX IF EXISTS "proxy_ports_status_idx";

-- Удаляем колонку status
ALTER TABLE "proxy_ports" DROP COLUMN IF EXISTS "status";

-- Удаляем колонку blocked_at, если она существует
ALTER TABLE "proxy_ports" DROP COLUMN IF EXISTS "blocked_at";

-- Удаляем enum ProxyPortStatus, если он существует и не используется
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProxyPortStatus') THEN
    -- Проверяем, используется ли enum где-то еще
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE udt_name = 'ProxyPortStatus'
    ) THEN
      DROP TYPE "ProxyPortStatus";
    END IF;
  END IF;
END $$;

-- Создаем индекс на lastActivityAt
CREATE INDEX IF NOT EXISTS "proxy_ports_last_activity_at_idx" ON "proxy_ports"("last_activity_at");





