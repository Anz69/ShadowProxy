-- 21.10.2026: все прокси со старых нод 84.21.173.112/.154 переезжают на 212.80.7.117.
-- Уникальность (server_host, user_login): одинаковые логины (с тем же паролем) жили на
-- нескольких нодах. Совпадающим строкам старых нод добавляем суффикс ноды, строка на
-- 212.80.7.117 остаётся как есть. Пароли, апстримы, пакеты, статусы не меняются.
BEGIN;
CREATE TEMP TABLE _moved AS
SELECT id, server_host AS old_host, user_login AS old_login FROM proxies WHERE server_host IN ('84.21.173.112','84.21.173.154');
SELECT old_host, count(*) FROM _moved GROUP BY 1;
UPDATE proxies p
SET user_login = p.user_login || CASE p.server_host WHEN '84.21.173.112' THEN '-n112' ELSE '-n154' END,
    updated_at = now()
WHERE p.server_host IN ('84.21.173.112','84.21.173.154')
  AND p.user_login IS NOT NULL
  AND EXISTS (SELECT 1 FROM proxies q WHERE q.user_login = p.user_login AND q.id <> p.id);
SELECT count(*) AS renamed FROM _moved m JOIN proxies p ON p.id = m.id WHERE p.user_login <> m.old_login;
UPDATE proxies SET server_host = '212.80.7.117', updated_at = now() WHERE server_host IN ('84.21.173.112','84.21.173.154');
SELECT server_host, status, count(*) FROM proxies WHERE server_host IS NOT NULL GROUP BY 1,2 ORDER BY 1,2;
-- журнал переноса для поддержки: старый хост/логин → новый
CREATE TABLE IF NOT EXISTS proxy_rehome_log_20261021 AS
SELECT m.id, m.old_host, m.old_login, p.server_host AS new_host, p.user_login AS new_login, p.user_id FROM _moved m JOIN proxies p ON p.id = m.id;
COMMIT;
