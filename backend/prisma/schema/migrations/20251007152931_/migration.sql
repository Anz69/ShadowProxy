/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `sub_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "sub_accounts_username_key" ON "public"."sub_accounts"("username");
