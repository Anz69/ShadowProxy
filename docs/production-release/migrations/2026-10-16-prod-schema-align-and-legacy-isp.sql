-- ShadowProxy prod 2026-10-16: align DB with Prisma schema (additive only) + park legacy ISP rows.
-- Enum ADD VALUE must run outside a transaction -> psql autocommit, one statement each.
ALTER TYPE "PackageType" ADD VALUE IF NOT EXISTS 'ISP_USA';
ALTER TYPE "PackageType" ADD VALUE IF NOT EXISTS 'ISP_EU';
ALTER TYPE "PackageType" ADD VALUE IF NOT EXISTS 'RESIDENTIAL_LITE';
ALTER TYPE "ProxyType"   ADD VALUE IF NOT EXISTS 'ISP_USA';
ALTER TYPE "ProxyType"   ADD VALUE IF NOT EXISTS 'ISP_EU';
ALTER TYPE "ProxyType"   ADD VALUE IF NOT EXISTS 'RESIDENTIAL_LITE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isp_usa_traffic_left"          TEXT NOT NULL DEFAULT '0';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isp_eu_traffic_left"           TEXT NOT NULL DEFAULT '0';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "residential_lite_traffic_left" TEXT NOT NULL DEFAULT '0';
DO $$ BEGIN CREATE TYPE "IpFamily" AS ENUM ('IPV4', 'IPV6'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RentedIpStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REPLACED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "broadcasts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "segment" TEXT NOT NULL,
    "recipients_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);
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
CREATE INDEX IF NOT EXISTS "rented_ips_user_id_idx" ON "rented_ips" ("user_id");
CREATE INDEX IF NOT EXISTS "rented_ips_status_expires_at_idx" ON "rented_ips" ("status", "expires_at");
DO $$ BEGIN
    ALTER TABLE "rented_ips" ADD CONSTRAINT "rented_ips_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Legacy ISP tariff: not in Prisma enum anymore; park rows in archive tables (no FKs reference keys/packages).
BEGIN;
CREATE TABLE IF NOT EXISTS "legacy_isp_packages_20261016" (LIKE "packages" INCLUDING ALL);
INSERT INTO "legacy_isp_packages_20261016" SELECT * FROM "packages" WHERE "type"::text = 'ISP';
DELETE FROM "packages" WHERE "type"::text = 'ISP';
CREATE TABLE IF NOT EXISTS "legacy_isp_keys_20261016" (LIKE "keys" INCLUDING ALL);
INSERT INTO "legacy_isp_keys_20261016" SELECT * FROM "keys" WHERE "type"::text = 'ISP';
DELETE FROM "keys" WHERE "type"::text = 'ISP';
COMMIT;
