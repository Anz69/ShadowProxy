-- Часть 2: анти-фрод триала + флаг скидки после триала.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "trial_discount_available" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "trial_identity" (
  "id"               TEXT NOT NULL,
  "provider"         TEXT NOT NULL,
  "provider_key"     TEXT NOT NULL,
  "used_by_user_id"  TEXT NOT NULL,
  "used_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trial_identity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trial_identity_provider_provider_key_key"
  ON "trial_identity"("provider", "provider_key");
