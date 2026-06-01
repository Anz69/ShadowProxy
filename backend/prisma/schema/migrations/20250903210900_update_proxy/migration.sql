/*
  Warnings:

  - Added the required column `protocol` to the `proxies` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ProxyProtocol" AS ENUM ('HTTP', 'HTTPS', 'SOCKS5');

-- AlterTable
ALTER TABLE "public"."proxies" ADD COLUMN     "protocol" "public"."ProxyProtocol" NOT NULL,
ADD COLUMN     "rotation_interval" INTEGER;
