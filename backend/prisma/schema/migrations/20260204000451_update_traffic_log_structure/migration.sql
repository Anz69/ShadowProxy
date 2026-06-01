-- Удаляем старую таблицу traffic_logs
DROP TABLE IF EXISTS "public"."traffic_logs";

-- Создаем новую таблицу traffic_logs с обновленной структурой
CREATE TABLE "public"."traffic_logs" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "in_bytes" BIGINT NOT NULL,
    "out_bytes" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hour" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "traffic_logs_package_id_date_hour_key" UNIQUE ("package_id", "date", "hour")
);

-- Создаем индексы для быстрого поиска
CREATE INDEX "traffic_logs_package_id_idx" ON "public"."traffic_logs"("package_id");
CREATE INDEX "traffic_logs_date_idx" ON "public"."traffic_logs"("date");
CREATE INDEX "traffic_logs_package_id_date_idx" ON "public"."traffic_logs"("package_id", "date");

-- Добавляем внешний ключ на packages
ALTER TABLE "public"."traffic_logs" ADD CONSTRAINT "traffic_logs_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

