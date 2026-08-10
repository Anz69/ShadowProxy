/*
  Warnings:

  - You are about to drop the column `resident_id` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "resident_id",
ADD COLUMN     "resident_data" TEXT NOT NULL DEFAULT '';
