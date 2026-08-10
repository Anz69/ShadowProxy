-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "balance" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "public"."users" ADD COLUMN "referral_balance" DECIMAL(65,30) NOT NULL DEFAULT 0;






