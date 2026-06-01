/*
  Warnings:

  - You are about to drop the column `residental_traffic_left` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "residental_traffic_left",
ADD COLUMN     "premiumUsername" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "resident_traffic_left" TEXT NOT NULL DEFAULT '0';
