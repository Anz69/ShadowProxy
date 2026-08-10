-- CreateEnum
CREATE TYPE "public"."KeyStatus" AS ENUM ('NEW', 'ACTIVATED');

-- AlterEnum
ALTER TYPE "public"."PackageType" ADD VALUE 'ISP';

-- AlterEnum
ALTER TYPE "public"."ProxyType" ADD VALUE 'ISP';

-- CreateTable
CREATE TABLE "public"."Key" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "activatedBy" TEXT,
    "type" "public"."PackageType" NOT NULL,
    "contents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Key_key_key" ON "public"."Key"("key");
