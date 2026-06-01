-- AlterEnum: Добавляем новые типы прокси MOBILE_GB и IPV6_GB
ALTER TYPE "public"."ProxyType" ADD VALUE IF NOT EXISTS 'MOBILE_GB';
ALTER TYPE "public"."ProxyType" ADD VALUE IF NOT EXISTS 'IPV6_GB';

-- AlterEnum: Добавляем новые типы пакетов MOBILE_GB и IPV6_GB
ALTER TYPE "public"."PackageType" ADD VALUE IF NOT EXISTS 'MOBILE_GB';
ALTER TYPE "public"."PackageType" ADD VALUE IF NOT EXISTS 'IPV6_GB';

-- AlterTable: Добавляем поле updated_at в таблицу packages
ALTER TABLE "public"."packages" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Создаем функцию для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создаем триггер для автоматического обновления updated_at при изменении записи
DROP TRIGGER IF EXISTS update_packages_updated_at ON "public"."packages";
CREATE TRIGGER update_packages_updated_at
    BEFORE UPDATE ON "public"."packages"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

