/*
  Warnings:

  - You are about to drop the column `metadata` on the `proxies` table. All the data in the column will be lost.
  - You are about to drop the column `outNode` on the `proxies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."proxies" DROP COLUMN "metadata",
DROP COLUMN "outNode";
