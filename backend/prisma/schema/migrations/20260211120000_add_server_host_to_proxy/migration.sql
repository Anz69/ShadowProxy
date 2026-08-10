-- Add missing columns to proxies table

-- Add user_port column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies' 
        AND column_name = 'user_port'
    ) THEN
        ALTER TABLE "public"."proxies" ADD COLUMN "user_port" INTEGER;
    END IF;
END $$;

-- Add user_login column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies' 
        AND column_name = 'user_login'
    ) THEN
        ALTER TABLE "public"."proxies" ADD COLUMN "user_login" TEXT;
    END IF;
END $$;

-- Add user_password column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies' 
        AND column_name = 'user_password'
    ) THEN
        ALTER TABLE "public"."proxies" ADD COLUMN "user_password" TEXT;
    END IF;
END $$;

-- Add server_host column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies' 
        AND column_name = 'server_host'
    ) THEN
        ALTER TABLE "public"."proxies" ADD COLUMN "server_host" TEXT;
    END IF;
END $$;

-- Add session_id column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies' 
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE "public"."proxies" ADD COLUMN "session_id" TEXT;
    END IF;
END $$;

-- Add last_activity_at column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxies' 
        AND column_name = 'last_activity_at'
    ) THEN
        ALTER TABLE "public"."proxies" ADD COLUMN "last_activity_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create unique indexes (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "proxies_user_port_key" ON "public"."proxies"("user_port");
CREATE UNIQUE INDEX IF NOT EXISTS "proxies_user_login_key" ON "public"."proxies"("user_login");

-- Create regular indexes (if not exists)
CREATE INDEX IF NOT EXISTS "proxies_user_id_idx" ON "public"."proxies"("user_id");
CREATE INDEX IF NOT EXISTS "proxies_server_host_idx" ON "public"."proxies"("server_host");
CREATE INDEX IF NOT EXISTS "proxies_last_activity_at_idx" ON "public"."proxies"("last_activity_at");
CREATE INDEX IF NOT EXISTS "proxies_user_port_idx" ON "public"."proxies"("user_port");
