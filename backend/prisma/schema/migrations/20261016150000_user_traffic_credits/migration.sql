-- Суммарно начисленный трафик по тарифу: остаток / начислено = полоска на дашборде.
CREATE TABLE IF NOT EXISTS "user_traffic_credits" (
    "id"             TEXT NOT NULL,
    "user_id"        TEXT NOT NULL,
    "type"           "ProxyType" NOT NULL,
    "credited_bytes" TEXT NOT NULL DEFAULT '0',
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_traffic_credits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_traffic_credits_user_id_type_key" ON "user_traffic_credits"("user_id", "type");

DO $$ BEGIN
    ALTER TABLE "user_traffic_credits"
        ADD CONSTRAINT "user_traffic_credits_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: лучшее известное «всего начислено» = текущий остаток + расход,
-- который успел попасть в traffic_logs пакета этого тарифа.
INSERT INTO "user_traffic_credits" ("id", "user_id", "type", "credited_bytes")
SELECT
    gen_random_uuid()::text,
    b.user_id,
    b.type,
    (b.remaining + COALESCE(u.used, 0))::text
FROM (
    SELECT id AS user_id, 'RESIDENT_PREMIUM'::"ProxyType"    AS type, COALESCE(NULLIF(premium_trafic_left, '')::numeric, 0)               AS remaining FROM users
    UNION ALL SELECT id, 'PREMIUM_RESIDENTIAL'::"ProxyType", COALESCE(NULLIF(premium_residential_traffic_left, '')::numeric, 0) FROM users
    UNION ALL SELECT id, 'MOBILE'::"ProxyType",              COALESCE(NULLIF(mobile_traffic_left, '')::numeric, 0)              FROM users
    UNION ALL SELECT id, 'MOBILE_GB'::"ProxyType",           COALESCE(NULLIF(mobile_gb_traffic_left, '')::numeric, 0)           FROM users
    UNION ALL SELECT id, 'IPV6_GB'::"ProxyType",             COALESCE(NULLIF(ipv6_gb_traffic_left, '')::numeric, 0)             FROM users
    UNION ALL SELECT id, 'ISP_USA'::"ProxyType",             COALESCE(NULLIF(isp_usa_traffic_left, '')::numeric, 0)             FROM users
    UNION ALL SELECT id, 'ISP_EU'::"ProxyType",              COALESCE(NULLIF(isp_eu_traffic_left, '')::numeric, 0)              FROM users
    UNION ALL SELECT id, 'RESIDENTIAL_LITE'::"ProxyType",    COALESCE(NULLIF(residential_lite_traffic_left, '')::numeric, 0)    FROM users
) b
LEFT JOIN (
    SELECT up.user_id, up.type, SUM(t.in_bytes + t.out_bytes) AS used
    FROM traffic_logs t
    JOIN user_packages up ON up.id = t.user_package_id
    GROUP BY up.user_id, up.type
) u ON u.user_id = b.user_id AND u.type = b.type
WHERE (b.remaining + COALESCE(u.used, 0)) > 0
ON CONFLICT ("user_id", "type") DO NOTHING;
