-- V2: все прокси на одном сервере используют user_port=10000
-- Убираем все unique на user_port (глобальный и составной с server_host)
DROP INDEX IF EXISTS "proxies_user_port_key";
DROP INDEX IF EXISTS "proxies_server_host_user_port_key";

-- Оставляем только не-unique индекс для поиска
CREATE INDEX IF NOT EXISTS "proxies_server_host_user_port_idx" ON "public"."proxies"("server_host", "user_port");
