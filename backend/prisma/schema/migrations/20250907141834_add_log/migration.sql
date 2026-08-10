-- CreateEnum
CREATE TYPE "public"."LogType" AS ENUM ('USAGE', 'REPLENISH', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."ProxyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "public"."proxies" ADD COLUMN     "status" "public"."ProxyStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "public"."Log" (
    "id" TEXT NOT NULL,
    "type" "public"."LogType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);
