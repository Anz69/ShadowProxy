ALTER TABLE "users" ADD COLUMN "utm_source" TEXT,
ADD COLUMN "utm_medium" TEXT,
ADD COLUMN "utm_campaign" TEXT,
ADD COLUMN "utm_campaign_id" TEXT;

CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "utm_source" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_campaign_expenses" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "comment" TEXT,
    "spent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_campaign_expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_campaign_notes" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_campaign_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_campaigns_slug_key" ON "marketing_campaigns"("slug");
CREATE INDEX "marketing_campaign_expenses_campaign_id_spent_at_idx" ON "marketing_campaign_expenses"("campaign_id", "spent_at");
CREATE INDEX "marketing_campaign_notes_campaign_id_created_at_idx" ON "marketing_campaign_notes"("campaign_id", "created_at");
CREATE INDEX "users_utm_campaign_id_idx" ON "users"("utm_campaign_id");
-- Статистика кампаний джойнит платежи по пользователю.
CREATE INDEX IF NOT EXISTS "payments_user_id_idx" ON "payments"("user_id");

ALTER TABLE "marketing_campaign_expenses" ADD CONSTRAINT "marketing_campaign_expenses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_campaign_notes" ADD CONSTRAINT "marketing_campaign_notes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_utm_campaign_id_fkey" FOREIGN KEY ("utm_campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
