-- Часть 1 (Система отзывов) + минимальный центр уведомлений.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "review_discount_available" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "reviews" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "rating"     INTEGER NOT NULL,
  "text"       TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "reviews_user_id_key" ON "reviews"("user_id");
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_user_id_fkey";
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "link"       TEXT,
  "read_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_fkey";
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
