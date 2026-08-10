/*
  Warnings:

  - Added the required column `region` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."UserRegion" AS ENUM ('CIS', 'EUROPE', 'USA');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "region" "public"."UserRegion" NOT NULL;
