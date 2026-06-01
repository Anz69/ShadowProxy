-- V2: один порт (10000) на сервер, много логинов — убираем unique(serverHost, userPort)
DROP INDEX IF EXISTS "proxies_server_host_user_port_key";

-- Индекс для поиска по serverHost+userPort (уже может быть)
CREATE INDEX IF NOT EXISTS "proxies_server_host_user_port_idx" ON "public"."proxies"("server_host", "user_port");
