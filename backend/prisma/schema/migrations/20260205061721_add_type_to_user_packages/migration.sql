-- AlterTable
ALTER TABLE "public"."user_packages" ADD COLUMN "type" "public"."ProxyType";

-- Fill existing records with type from package (cast PackageType to ProxyType)
UPDATE "public"."user_packages" up
SET "type" = p."type"::text::"public"."ProxyType"
FROM "public"."packages" p
WHERE up."package_id" = p."id";

-- Make type NOT NULL
ALTER TABLE "public"."user_packages" ALTER COLUMN "type" SET NOT NULL;

-- Make packageId nullable (since type is now the primary identifier)
ALTER TABLE "public"."user_packages" ALTER COLUMN "package_id" DROP NOT NULL;

