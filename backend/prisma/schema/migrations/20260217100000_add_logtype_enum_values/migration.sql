-- Add missing LogType enum values (TRAFFIC, USER_ACTION, API) to match Prisma schema.
-- Original migration only created USAGE, REPLENISH, SYSTEM.
ALTER TYPE "public"."LogType" ADD VALUE IF NOT EXISTS 'TRAFFIC';
ALTER TYPE "public"."LogType" ADD VALUE IF NOT EXISTS 'USER_ACTION';
ALTER TYPE "public"."LogType" ADD VALUE IF NOT EXISTS 'API';
