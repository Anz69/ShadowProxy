ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "proxyempire_subuser_email" TEXT,
  ADD COLUMN IF NOT EXISTS "proxyempire_subuser_token" TEXT;
