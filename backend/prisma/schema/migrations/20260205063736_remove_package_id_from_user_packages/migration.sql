-- Drop the unique constraint on [userId, packageId]
ALTER TABLE "public"."user_packages" DROP CONSTRAINT IF EXISTS "user_packages_user_id_package_id_key";

-- Drop the foreign key constraint
ALTER TABLE "public"."user_packages" DROP CONSTRAINT IF EXISTS "user_packages_package_id_fkey";

-- Drop the package_id column
ALTER TABLE "public"."user_packages" DROP COLUMN IF EXISTS "package_id";

-- Create new unique constraint on [userId, type] (Prisma will use this name for the composite unique)
CREATE UNIQUE INDEX IF NOT EXISTS "user_packages_user_id_type_key" ON "public"."user_packages"("user_id", "type");

