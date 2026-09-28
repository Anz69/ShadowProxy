CREATE TABLE "proxy_traffic_batch_receipts" (
    "id" TEXT NOT NULL,
    "server_host" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_traffic_batch_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proxy_traffic_batch_receipts_created_at_idx"
    ON "proxy_traffic_batch_receipts"("created_at");
