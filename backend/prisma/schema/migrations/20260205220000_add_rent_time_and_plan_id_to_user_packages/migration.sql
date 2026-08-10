-- AlterTable
ALTER TABLE "user_packages" ADD COLUMN IF NOT EXISTS "rent_time" INTEGER;

-- AlterTable
ALTER TABLE "user_packages" ADD COLUMN IF NOT EXISTS "plan_id" VARCHAR(255);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_packages_rent_time_idx" ON "user_packages"("rent_time");

