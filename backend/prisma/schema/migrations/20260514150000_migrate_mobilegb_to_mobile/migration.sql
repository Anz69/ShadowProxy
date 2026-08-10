-- Миграция legacy MOBILE_GB (FlashProxy/LTE-Socks) на новый MOBILE (ProxyEmpire).
-- Переносит баланс 1:1: mobile_traffic_left += mobile_gb_traffic_left.
-- После применения cron syncProxyEmpireUsage за один tick создаст PE sub-user
-- и зальёт квоту через addSubUserBandwidth (см. proxy.service.ts:406-431, блок stragglers).
--
-- Откат: обратное UPDATE и обнуление mobile_traffic_left для пострадавших,
-- но потребует ручного DELETE PE sub-user через ProxyEmpire панель.

UPDATE users
SET mobile_traffic_left = (
        COALESCE(NULLIF(mobile_traffic_left, '')::numeric, 0)
      + COALESCE(NULLIF(mobile_gb_traffic_left, '')::numeric, 0)
    )::bigint::text,
    mobile_gb_traffic_left = '0',
    updated_at = NOW()
WHERE COALESCE(NULLIF(mobile_gb_traffic_left, '')::numeric, 0) > 0;
