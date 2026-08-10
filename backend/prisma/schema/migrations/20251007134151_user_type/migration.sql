-- CreateEnum
CREATE TYPE "public"."UserType" AS ENUM ('SITE', 'TELEGRAM');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "type" "public"."UserType" NOT NULL DEFAULT 'SITE';

-- CreateTable
CREATE TABLE "public"."sub_accounts" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "sub_accounts_pkey" PRIMARY KEY ("id")
);
