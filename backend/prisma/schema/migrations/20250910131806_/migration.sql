/*
  Warnings:

  - You are about to drop the column `resident_data` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "resident_data",
ADD COLUMN     "resident_id" TEXT NOT NULL DEFAULT '';
