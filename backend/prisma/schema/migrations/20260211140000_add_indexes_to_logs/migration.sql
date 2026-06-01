-- Add indexes to logs table

-- Index on type
CREATE INDEX IF NOT EXISTS "logs_type_idx" ON "public"."logs"("type");

-- Index on userId
CREATE INDEX IF NOT EXISTS "logs_userId_idx" ON "public"."logs"("userId");

-- Index on createdAt
CREATE INDEX IF NOT EXISTS "logs_createdAt_idx" ON "public"."logs"("createdAt");

-- Composite index on type + createdAt
CREATE INDEX IF NOT EXISTS "logs_type_createdAt_idx" ON "public"."logs"("type", "createdAt");

-- Composite index on userId + createdAt
CREATE INDEX IF NOT EXISTS "logs_userId_createdAt_idx" ON "public"."logs"("userId", "createdAt");

-- Очищаем orphan-записи (userId указывает на несуществующего user) перед добавлением FK
UPDATE "public"."logs" 
SET "userId" = NULL 
WHERE "userId" IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM "public"."users" WHERE "id" = "logs"."userId");

-- Add foreign key to users (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'logs_userId_fkey' 
        AND table_name = 'logs'
    ) THEN
        ALTER TABLE "public"."logs" 
        ADD CONSTRAINT "logs_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "public"."users"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
