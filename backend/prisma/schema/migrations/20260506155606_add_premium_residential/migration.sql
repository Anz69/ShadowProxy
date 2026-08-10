-- AlterEnum: ProxyType
ALTER TYPE "ProxyType" ADD VALUE 'PREMIUM_RESIDENTIAL';

-- AlterEnum: PackageType
ALTER TYPE "PackageType" ADD VALUE 'PREMIUM_RESIDENTIAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "premium_residential_traffic_left" TEXT NOT NULL DEFAULT '0';
