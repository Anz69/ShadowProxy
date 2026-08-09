-- Система поддержки: тикеты (один диалог на юзера) + сообщения с вложениями.
-- SQL идемпотентный по конвенции проекта (повторный прогон безвреден).

DO $$ BEGIN
    CREATE TYPE "public"."SupportTicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'ANSWERED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "public"."SupportAuthor" AS ENUM ('USER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "support_tickets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "public"."SupportTicketStatus" NOT NULL DEFAULT 'NEW',
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_user_id_key" ON "support_tickets"("user_id");
CREATE INDEX IF NOT EXISTS "support_tickets_status_last_message_at_idx" ON "support_tickets"("status", "last_message_at");

ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "support_tickets_user_id_fkey";
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "support_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_role" "public"."SupportAuthor" NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");
CREATE INDEX IF NOT EXISTS "support_messages_ticket_id_author_role_read_at_idx" ON "support_messages"("ticket_id", "author_role", "read_at");

ALTER TABLE "support_messages" DROP CONSTRAINT IF EXISTS "support_messages_ticket_id_fkey";
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
