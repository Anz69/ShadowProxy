-- 1) user_login: уникальность только в рамках одного сервера (как и user_port)
DROP INDEX IF EXISTS "proxies_user_login_key";
CREATE UNIQUE INDEX "proxies_server_host_user_login_key" ON "public"."proxies"("server_host", "user_login");

-- 2) Удаление устаревшей таблицы proxy_ports (данные в proxies)
DROP TABLE IF EXISTS "public"."proxy_ports" CASCADE;
