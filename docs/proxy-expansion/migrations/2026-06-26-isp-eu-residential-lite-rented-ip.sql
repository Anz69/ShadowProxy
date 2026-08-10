-- ============================================================================
-- Миграция: ISP EU + Residential Lite (Sprint 3) + заготовка IPv4/IPv6 (Sprint 4)
-- Применять на сервере вручную (prisma db push небезопасен — см. dev-copy-deploy).
--
-- ВАЖНО: ALTER TYPE ... ADD VALUE нельзя выполнять внутри транзакции, в которой
-- это значение затем используется. Поэтому enum-значения добавляем отдельно,
-- БЕЗ оборачивания в один BEGIN/COMMIT с остальным. Запускать как есть (psql
-- выполнит каждый стейтмент в autocommit).
-- ============================================================================

-- 1) Новые значения enum типов прокси/пакетов -------------------------------
ALTER TYPE "ProxyType"   ADD VALUE IF NOT EXISTS 'ISP_EU';
ALTER TYPE "ProxyType"   ADD VALUE IF NOT EXISTS 'RESIDENTIAL_LITE';
ALTER TYPE "PackageType" ADD VALUE IF NOT EXISTS 'ISP_EU';
ALTER TYPE "PackageType" ADD VALUE IF NOT EXISTS 'RESIDENTIAL_LITE';

-- 2) Балансы трафика новых типов (считаются только на нашей стороне) ---------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isp_eu_traffic_left"          TEXT NOT NULL DEFAULT '0';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "residential_lite_traffic_left" TEXT NOT NULL DEFAULT '0';

-- 3) Sprint 4 (п.5) — заготовка под аренду IPv4/IPv6 на время ----------------
--    Структура заводится заранее; бизнес-логика будет добавлена позже.
DO $$ BEGIN
    CREATE TYPE "IpFamily" AS ENUM ('IPV4', 'IPV6');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "RentedIpStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REPLACED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "rented_ips" (
    "id"            TEXT NOT NULL,
    "user_id"       TEXT NOT NULL,
    "family"        "IpFamily" NOT NULL,
    "ip"            TEXT NOT NULL,
    "upstream_ref"  TEXT,
    "rented_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at"    TIMESTAMP(3) NOT NULL,
    "auto_renew"    BOOLEAN NOT NULL DEFAULT false,
    "notified_3d"   BOOLEAN NOT NULL DEFAULT false,
    "replace_count" INTEGER NOT NULL DEFAULT 0,
    "status"        "RentedIpStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rented_ips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rented_ips_user_id_idx"             ON "rented_ips" ("user_id");
CREATE INDEX IF NOT EXISTS "rented_ips_status_expires_at_idx"   ON "rented_ips" ("status", "expires_at");

DO $$ BEGIN
    ALTER TABLE "rented_ips"
        ADD CONSTRAINT "rented_ips_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
