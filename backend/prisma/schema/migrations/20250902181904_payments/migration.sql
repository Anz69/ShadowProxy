/*
  Warnings:

  - You are about to drop the `transactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('WAITING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('CRYPTO_BOT', 'HELEKET');

-- DropForeignKey
ALTER TABLE "public"."transactions" DROP CONSTRAINT "transactions_user_id_fkey";

-- DropTable
DROP TABLE "public"."transactions";

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "amountUsd" DECIMAL(65,30) NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'WAITING',
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
