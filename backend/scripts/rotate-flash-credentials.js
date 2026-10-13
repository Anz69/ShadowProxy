#!/usr/bin/env node

/** Rotate stored Flash upstream credentials without changing customers' gateway logins. */
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), override: false });

const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm=FLASH_CREDENTIAL_ROTATION");
if (apply && !confirm) throw new Error("Для изменения добавьте --confirm=FLASH_CREDENTIAL_ROTATION");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Не задан ${name}`);
  return value;
}

function databaseUrl() {
  const explicit = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (explicit && !explicit.includes("${")) return explicit.trim();
  return `postgresql://${encodeURIComponent(process.env.POSTGRES_USERNAME || "postgres")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DATABASE || "shadow_proxy"}`;
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
const config = {
  ISP_USA: { host: process.env.FLASH_ISP_USA_HOST || "beta.flashproxy.io", user: required("FLASH_ISP_USA_USERNAME"), pass: required("FLASH_ISP_USA_PASSWORD") },
  RESIDENTIAL_LITE: { host: process.env.FLASH_RESIDENTIAL_LITE_HOST || "lite.flashproxy.io", user: required("FLASH_RESIDENTIAL_LITE_USERNAME"), pass: required("FLASH_RESIDENTIAL_LITE_PASSWORD") },
};

function nextCredentials(proxy) {
  const target = config[proxy.type];
  if (proxy.host !== target.host) throw new Error(`Proxy ${proxy.id}: неожиданный host`);
  const delimiter = "-country-";
  const position = proxy.username.indexOf(delimiter);
  if (position < 1 || !/^[A-Z]{2}(?:-time-\d+-session-[A-Za-z0-9]{8})?$/.test(proxy.username.slice(position + delimiter.length))) {
    throw new Error(`Proxy ${proxy.id}: неожиданный формат upstream username`);
  }
  return { username: target.user + proxy.username.slice(position), password: target.pass };
}

async function syncServer(serverHost) {
  const server = await prisma.proxyServer.findFirst({ where: { host: serverHost }, select: { token: true } });
  if (!server?.token) throw new Error(`Нет gateway token для ${serverHost}`);
  const active = await prisma.proxy.findMany({ where: { serverHost, status: "ACTIVE", userPort: { not: null }, userLogin: { not: null }, userPassword: { not: null } } });
  const ports = active.map(proxy => ({
    port: proxy.userPort, login: proxy.userLogin, password: proxy.userPassword,
    proxy_host: proxy.host, proxy_port: proxy.port,
    proxy_username: proxy.username, proxy_password: proxy.password,
  }));
  await axios.post(`http://${serverHost}:808/sync_active_ports`, { activePorts: ports, timestamp: Date.now() }, {
    headers: { Authorization: `Bearer ${server.token}` }, timeout: 30000,
  });
  return ports.length;
}

async function main() {
  const proxies = await prisma.proxy.findMany({ where: { type: { in: ["ISP_USA", "RESIDENTIAL_LITE"] } } });
  const changes = proxies.map(proxy => ({ proxy, next: nextCredentials(proxy) }))
    .filter(({ proxy, next }) => proxy.username !== next.username || proxy.password !== next.password);
  const servers = [...new Set(changes.filter(({ proxy }) => proxy.status === "ACTIVE" && proxy.serverHost).map(({ proxy }) => proxy.serverHost))];
  console.log(`Flash credential rotation: ${changes.length} records; ${servers.length} gateways; mode=${apply ? "apply" : "dry-run"}`);
  if (!apply || !changes.length) return;

  // All preflight checks precede the first database mutation.
  for (const host of servers) {
    const server = await prisma.proxyServer.findFirst({ where: { host }, select: { token: true } });
    if (!server?.token) throw new Error(`Нет gateway token для ${host}`);
    await axios.get(`http://${host}:808/health`, { headers: { Authorization: `Bearer ${server.token}` }, timeout: 5000 });
  }

  const journalPath = path.join("/secure", `flash-credentials-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const journal = changes.map(({ proxy }) => ({ id: proxy.id, username: proxy.username, password: proxy.password }));
  const fd = fs.openSync(journalPath, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(journal)); } finally { fs.closeSync(fd); }
  console.log(`Private rollback journal saved (${changes.length} records)`);

  await prisma.$transaction(async tx => {
    for (const { proxy, next } of changes) {
      const updated = await tx.proxy.updateMany({ where: { id: proxy.id, username: proxy.username, password: proxy.password }, data: next });
      if (updated.count !== 1) throw new Error(`Proxy ${proxy.id} changed concurrently`);
    }
  });

  try {
    for (const host of servers) console.log(`Gateway ${host}: synced ${await syncServer(host)} active logins`);
  } catch (error) {
    console.error("Gateway sync failed; restoring original credentials");
    await prisma.$transaction(async tx => {
      for (const { proxy, next } of changes) {
        await tx.proxy.updateMany({ where: { id: proxy.id, username: next.username, password: next.password }, data: { username: proxy.username, password: proxy.password } });
      }
    });
    for (const host of servers) {
      try { await syncServer(host); } catch { console.error(`Rollback sync failed for ${host}`); }
    }
    throw error;
  }
  console.log(`Flash credential rotation complete: ${changes.length} records`);
}

main().catch(error => { console.error(error.message || error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
