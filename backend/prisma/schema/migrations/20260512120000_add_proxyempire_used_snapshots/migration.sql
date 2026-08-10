ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "proxyempire_resi_used_snapshot" TEXT NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS "proxyempire_mobile_used_snapshot" TEXT NOT NULL DEFAULT '0';
