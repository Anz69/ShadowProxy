/*
  Warnings:

  - You are about to drop the column `mobile_lime_left` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[key]` on the table `settings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ProxyType" AS ENUM ('RESIDENT', 'RESIDENT_PREMIUM', 'MOBILE');

-- CreateEnum
CREATE TYPE "public"."ProxyRotation" AS ENUM ('BY_REQUEST', 'BY_TIME');

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "mobile_lime_left";

-- CreateTable
CREATE TABLE "public"."proxies" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "type" "public"."ProxyType" NOT NULL,
    "country" TEXT NOT NULL,
    "rotation" "public"."ProxyRotation" NOT NULL,
    "traffic_used" INTEGER NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "proxies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "public"."settings"("key");

-- AddForeignKey
ALTER TABLE "public"."proxies" ADD CONSTRAINT "proxies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
