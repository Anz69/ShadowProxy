-- Permanent one-time marker so the review discount cannot be re-granted
-- if a user's review is later deleted (e.g. by an admin) and re-created.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "review_discount_granted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: users who already have a review have already received the discount.
UPDATE "users" SET "review_discount_granted" = true
WHERE "id" IN (SELECT "user_id" FROM "reviews");
