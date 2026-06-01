-- AlterEnum
ALTER TYPE "public"."ProxyRotation" ADD VALUE 'AUTO';

-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "premiumUsername" SET DEFAULT 'premium_username';
