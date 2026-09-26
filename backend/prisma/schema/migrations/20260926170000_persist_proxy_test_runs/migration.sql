CREATE TABLE "proxy_test_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "target" TEXT NOT NULL,
    "country" TEXT,
    "size_mb" DOUBLE PRECISION NOT NULL,
    "samples_per_tariff" INTEGER NOT NULL,
    "concurrency" INTEGER NOT NULL,
    "gateway_host" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_test_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proxy_test_runs_status_created_at_idx" ON "proxy_test_runs"("status", "created_at");
