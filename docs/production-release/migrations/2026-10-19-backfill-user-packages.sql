-- Пакеты (user_packages) для всех балансов > 0, у которых нет строки своего типа.
-- Миграция 20260514 перенесла mobile_gb → mobile_traffic_left, а Mango-балансы жили без пакетов:
-- дашборд показывает остаток только по типам с пакетом, поэтому пользователи видели «баланс пропал».
BEGIN;
CREATE TEMP TABLE _bf AS
SELECT u.id AS user_id, t.type
FROM users u
CROSS JOIN LATERAL (VALUES
    ('MOBILE'::"ProxyType",              COALESCE(NULLIF(u.mobile_traffic_left,'')::numeric,0)),
    ('RESIDENT_PREMIUM'::"ProxyType",    COALESCE(NULLIF(u.premium_trafic_left,'')::numeric,0)),
    ('PREMIUM_RESIDENTIAL'::"ProxyType", COALESCE(NULLIF(u.premium_residential_traffic_left,'')::numeric,0)),
    ('ISP_USA'::"ProxyType",             COALESCE(NULLIF(u.isp_usa_traffic_left,'')::numeric,0)),
    ('ISP_EU'::"ProxyType",              COALESCE(NULLIF(u.isp_eu_traffic_left,'')::numeric,0)),
    ('RESIDENTIAL_LITE'::"ProxyType",    COALESCE(NULLIF(u.residential_lite_traffic_left,'')::numeric,0)),
    ('IPV6_GB'::"ProxyType",             COALESCE(NULLIF(u.ipv6_gb_traffic_left,'')::numeric,0))
) AS t(type, remaining)
WHERE t.remaining > 0
  AND NOT EXISTS (SELECT 1 FROM user_packages p WHERE p.user_id = u.id AND p.type = t.type);
SELECT type, count(*) AS to_create FROM _bf GROUP BY type ORDER BY 2 DESC;
INSERT INTO user_packages (id, user_id, type, created_at, updated_at)
SELECT gen_random_uuid()::text, user_id, type, now(), now() FROM _bf
ON CONFLICT (user_id, type) DO NOTHING;
SELECT count(*) AS packages_total FROM user_packages;
COMMIT;
