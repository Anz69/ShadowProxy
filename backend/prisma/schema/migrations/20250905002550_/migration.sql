/*
  Warnings:

  - You are about to drop the column `premiumUsername` on the `users` table. All the data in the column will be lost.
  - Added the required column `premium_username` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "premiumUsername",
ADD COLUMN     "premium_username" TEXT NOT NULL;
