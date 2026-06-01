-- Add token column to proxy_servers table

-- Add token column (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proxy_servers' 
        AND column_name = 'token'
    ) THEN
        ALTER TABLE "public"."proxy_servers" ADD COLUMN "token" TEXT;
    END IF;
END $$;

-- Create unique index on token (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "proxy_servers_token_key" ON "public"."proxy_servers"("token");
