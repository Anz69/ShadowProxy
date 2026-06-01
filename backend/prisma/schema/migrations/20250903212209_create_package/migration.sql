-- CreateEnum
CREATE TYPE "public"."PackageType" AS ENUM ('RESIDENT', 'RESIDENT_PREMIUM');

-- CreateTable
CREATE TABLE "public"."packages" (
    "id" TEXT NOT NULL,
    "type" "public"."PackageType" NOT NULL,
    "traffic" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);
