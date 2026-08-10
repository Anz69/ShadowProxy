/*
  Warnings:

  - You are about to alter the column `residental_traffic_left` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `BigInt`.
  - You are about to alter the column `premium_trafic_left` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `BigInt`.

*/
-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "residental_traffic_left" SET DEFAULT 0,
ALTER COLUMN "residental_traffic_left" SET DATA TYPE BIGINT,
ALTER COLUMN "premium_trafic_left" SET DEFAULT 0,
ALTER COLUMN "premium_trafic_left" SET DATA TYPE BIGINT;
