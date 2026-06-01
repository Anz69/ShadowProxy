/*
  Warnings:

  - You are about to drop the `Key` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."Key";

-- CreateTable
CREATE TABLE "public"."keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "public"."KeyStatus" NOT NULL DEFAULT 'NEW',
    "activatedBy" TEXT,
    "type" "public"."PackageType" NOT NULL,
    "contents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "keys_key_key" ON "public"."keys"("key");
