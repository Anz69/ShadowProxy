-- Drop the old index on packageId (if exists)
DROP INDEX IF EXISTS "proxies_package_id_idx";

-- Drop the foreign key constraint on packageId (if exists)
ALTER TABLE "public"."proxies" DROP CONSTRAINT IF EXISTS "proxies_package_id_fkey";

-- Add new column userPackageId (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies' 
        AND column_name = 'user_package_id'
    ) THEN
        ALTER TABLE "public"."proxies" ADD COLUMN "user_package_id" TEXT;
    END IF;
END $$;

-- Create index on userPackageId (if not exists)
CREATE INDEX IF NOT EXISTS "proxies_user_package_id_idx" ON "public"."proxies"("user_package_id");

-- Migrate existing data: for each proxy with packageId, find or create UserPackage
-- Only run if package_id column still exists
DO $$
DECLARE
    proxy_record RECORD;
    user_package_record RECORD;
    package_id_exists BOOLEAN;
BEGIN
    -- Check if package_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies' 
        AND column_name = 'package_id'
    ) INTO package_id_exists;

    -- Only migrate if package_id column exists
    IF package_id_exists THEN
        -- Loop through all proxies that have packageId
        FOR proxy_record IN 
            SELECT p.id, p.user_id, p.package_id, pkg.type
            FROM "public"."proxies" p
            INNER JOIN "public"."packages" pkg ON p.package_id = pkg.id
            WHERE p.package_id IS NOT NULL AND p.user_id IS NOT NULL
        LOOP
            -- Try to find existing UserPackage for this user and type
            SELECT * INTO user_package_record
            FROM "public"."user_packages"
            WHERE user_id = proxy_record.user_id 
              AND type::text = proxy_record.type::text
            LIMIT 1;

            -- If UserPackage doesn't exist, create it
            IF NOT FOUND THEN
                INSERT INTO "public"."user_packages" (id, user_id, type, created_at, updated_at)
                VALUES (
                    gen_random_uuid(),
                    proxy_record.user_id,
                    proxy_record.type::text::"public"."ProxyType",
                    NOW(),
                    NOW()
                )
                RETURNING * INTO user_package_record;
            END IF;

            -- Update proxy with userPackageId
            UPDATE "public"."proxies"
            SET user_package_id = user_package_record.id
            WHERE id = proxy_record.id;
        END LOOP;
    END IF;
END $$;

-- Add foreign key constraint (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'proxies_user_package_id_fkey' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "public"."proxies" 
        ADD CONSTRAINT "proxies_user_package_id_fkey" 
        FOREIGN KEY ("user_package_id") 
        REFERENCES "public"."user_packages"("id") 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Drop the old packageId column (if exists)
ALTER TABLE "public"."proxies" DROP COLUMN IF EXISTS "package_id";
