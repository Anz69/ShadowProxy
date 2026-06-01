-- CreateEnum
CREATE TYPE "public"."ProxyPortStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."ProxyServerStatus" AS ENUM ('ACTIVE', 'OFFLINE');

-- CreateTable
CREATE TABLE "public"."proxy_ports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "package_id" TEXT,
    "proxy_id" TEXT,
    "port" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "session_id" TEXT,
    "status" "public"."ProxyPortStatus" NOT NULL DEFAULT 'ACTIVE',
    "blocked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_ports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proxy_servers" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "status" "public"."ProxyServerStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."traffic_logs" (
    "id" TEXT NOT NULL,
    "proxy_port_id" TEXT NOT NULL,
    "in_bytes" BIGINT NOT NULL,
    "out_bytes" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traffic_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proxy_ports_port_key" ON "public"."proxy_ports"("port");

-- CreateIndex
CREATE UNIQUE INDEX "proxy_ports_login_key" ON "public"."proxy_ports"("login");

-- CreateIndex
CREATE INDEX "proxy_ports_user_id_idx" ON "public"."proxy_ports"("user_id");

-- CreateIndex
CREATE INDEX "proxy_ports_server_id_idx" ON "public"."proxy_ports"("server_id");

-- CreateIndex
CREATE INDEX "proxy_ports_package_id_idx" ON "public"."proxy_ports"("package_id");

-- CreateIndex
CREATE INDEX "proxy_ports_proxy_id_idx" ON "public"."proxy_ports"("proxy_id");

-- CreateIndex
CREATE INDEX "proxy_ports_status_idx" ON "public"."proxy_ports"("status");

-- CreateIndex
CREATE INDEX "proxy_ports_port_idx" ON "public"."proxy_ports"("port");

-- CreateIndex
CREATE INDEX "proxy_servers_status_idx" ON "public"."proxy_servers"("status");

-- CreateIndex
CREATE INDEX "proxy_servers_host_idx" ON "public"."proxy_servers"("host");

-- CreateIndex
CREATE INDEX "traffic_logs_proxy_port_id_idx" ON "public"."traffic_logs"("proxy_port_id");

-- CreateIndex
CREATE INDEX "traffic_logs_timestamp_idx" ON "public"."traffic_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."proxy_ports" ADD CONSTRAINT "proxy_ports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_ports" ADD CONSTRAINT "proxy_ports_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."proxy_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_ports" ADD CONSTRAINT "proxy_ports_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_ports" ADD CONSTRAINT "proxy_ports_proxy_id_fkey" FOREIGN KEY ("proxy_id") REFERENCES "public"."proxies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traffic_logs" ADD CONSTRAINT "traffic_logs_proxy_port_id_fkey" FOREIGN KEY ("proxy_port_id") REFERENCES "public"."proxy_ports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
