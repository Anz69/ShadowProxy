-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "residental_traffic_left" SET DEFAULT '0',
ALTER COLUMN "residental_traffic_left" SET DATA TYPE TEXT,
ALTER COLUMN "premium_trafic_left" SET DEFAULT '0',
ALTER COLUMN "premium_trafic_left" SET DATA TYPE TEXT;
