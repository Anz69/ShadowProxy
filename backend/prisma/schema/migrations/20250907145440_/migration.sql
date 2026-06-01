-- AlterTable
ALTER TABLE "public"."proxies" ALTER COLUMN "traffic_used" SET DEFAULT '0',
ALTER COLUMN "traffic_used" SET DATA TYPE TEXT;
