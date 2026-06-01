-- Уникальность порта только в рамках одного сервера (на разных серверах один и тот же user_port допустим)
-- Удаляем глобальный unique с user_port
DROP INDEX IF EXISTS "proxies_user_port_key";

-- Добавляем составной unique: (server_host, user_port)
CREATE UNIQUE INDEX "proxies_server_host_user_port_key" ON "public"."proxies"("server_host", "user_port");
