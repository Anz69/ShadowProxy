/*
  Warnings:

  - The values [HTTPS] on the enum `ProxyProtocol` will be removed. If these variants are still used in the database, this will fail.
  - Changed the type of `value` on the `settings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ProxyProtocol_new" AS ENUM ('HTTP', 'SOCKS5');
ALTER TABLE "public"."proxies" ALTER COLUMN "protocol" TYPE "public"."ProxyProtocol_new" USING ("protocol"::text::"public"."ProxyProtocol_new");
ALTER TYPE "public"."ProxyProtocol" RENAME TO "ProxyProtocol_old";
ALTER TYPE "public"."ProxyProtocol_new" RENAME TO "ProxyProtocol";
DROP TYPE "public"."ProxyProtocol_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."settings" DROP COLUMN "value",
ADD COLUMN     "value" JSONB NOT NULL;
