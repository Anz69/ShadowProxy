-- Миграция для исправления связи TrafficLog: с Package на UserPackage
-- TrafficLog должен быть привязан к UserPackage (пакет конкретного пользователя),
-- а не к Package (тарифный план для продажи)

-- 1. Удаляем старый unique constraint
ALTER TABLE "traffic_logs" DROP CONSTRAINT IF EXISTS "traffic_logs_package_id_date_hour_key";

-- 2. Удаляем старые индексы
DROP INDEX IF EXISTS "traffic_logs_package_id_idx";
DROP INDEX IF EXISTS "traffic_logs_package_id_date_idx";

-- 3. Удаляем старый foreign key
ALTER TABLE "traffic_logs" DROP CONSTRAINT IF EXISTS "traffic_logs_package_id_fkey";

-- 4. Добавляем новый столбец user_package_id
ALTER TABLE "traffic_logs" ADD COLUMN IF NOT EXISTS "user_package_id" TEXT;

-- 5. Очищаем старые данные (они были неправильно привязаны к Package вместо UserPackage)
DELETE FROM "traffic_logs";

-- 6. Делаем столбец NOT NULL
ALTER TABLE "traffic_logs" ALTER COLUMN "user_package_id" SET NOT NULL;

-- 7. Удаляем старый столбец package_id
ALTER TABLE "traffic_logs" DROP COLUMN IF EXISTS "package_id";

-- 8. Добавляем foreign key на user_packages
ALTER TABLE "traffic_logs" ADD CONSTRAINT "traffic_logs_user_package_id_fkey" 
    FOREIGN KEY ("user_package_id") REFERENCES "user_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. Создаём новые индексы
CREATE INDEX "traffic_logs_user_package_id_idx" ON "traffic_logs"("user_package_id");
CREATE INDEX "traffic_logs_user_package_id_date_idx" ON "traffic_logs"("user_package_id", "date");

-- 10. Создаём новый unique constraint
CREATE UNIQUE INDEX "traffic_logs_user_package_id_date_hour_key" ON "traffic_logs"("user_package_id", "date", "hour");
