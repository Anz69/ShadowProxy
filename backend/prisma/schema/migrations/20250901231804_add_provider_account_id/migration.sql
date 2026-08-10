/*
  Warnings:

  - A unique constraint covering the columns `[providerAccountId]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `providerAccountId` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."accounts" ADD COLUMN     "providerAccountId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerAccountId_key" ON "public"."accounts"("providerAccountId");
