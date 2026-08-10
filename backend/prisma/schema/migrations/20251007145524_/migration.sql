/*
  Warnings:

  - You are about to drop the column `type` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."sub_accounts" ADD COLUMN     "ipLeft" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "type";

-- DropEnum
DROP TYPE "public"."UserType";
