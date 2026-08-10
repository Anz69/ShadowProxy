/*
  Warnings:

  - You are about to drop the column `protocol` on the `proxies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."proxies" DROP COLUMN "protocol";
