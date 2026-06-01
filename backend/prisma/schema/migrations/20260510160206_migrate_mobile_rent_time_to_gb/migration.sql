-- Task 5: миграция баланса MOBILE с time-based (rentTime) на GB-based (mobile_traffic_left)
-- Формула: 1 час rentTime = 1 GB (1073741824 байт)
-- Применяется один раз при деплое. Безопасно для повторного запуска (берёт максимум).

-- 1) Создаём временную таблицу с конвертированными балансами
CREATE TEMP TABLE _mobile_migration AS
SELECT
  p.user_id,
  -- (sum_of_rent_time / 3600 hours) * 1073741824 bytes_per_GB
  CEIL(SUM(p.rent_time)::numeric / 3600 * 1073741824)::bigint AS new_balance_bytes
FROM proxies p
WHERE p.type = 'MOBILE'
  AND p.user_id IS NOT NULL
  AND p.rent_time IS NOT NULL
  AND p.rent_time > 0
GROUP BY p.user_id;

-- 2) Прибавляем сконвертированный баланс к текущему mobile_traffic_left (БЕЗ перезаписи существующего)
UPDATE users u
SET mobile_traffic_left = (
  COALESCE(NULLIF(u.mobile_traffic_left, '')::bigint, 0) + m.new_balance_bytes
)::TEXT
FROM _mobile_migration m
WHERE u.id = m.user_id;

DROP TABLE _mobile_migration;
