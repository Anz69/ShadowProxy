#!/usr/bin/env node

/**
 * Проверяет все gateway-ноды по TCP/control-plane и реальному прокси из БД.
 * Без флагов только отчёт. --execute --keep=<host> оставляет ACTIVE одну ноду.
 */

const path = require("path");
const net = require("net");
const axios = require("axios");
const { spawnSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const { writePrivateJson } = require("./lib/mango-reconcile-core");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), override: false });

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const keep = args.find((arg) => arg.startsWith("--keep="))?.slice("--keep=".length);
const force = args.includes("--force");
const confirm = args.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length);
const reportFile = args.find((arg) => arg.startsWith("--report-file="))?.slice("--report-file=".length);

if (execute && confirm !== "GATEWAY_SINGLE_NODE") {
  throw new Error("Для переключения добавьте --confirm=GATEWAY_SINGLE_NODE");
}
if (execute && !reportFile) {
  throw new Error("Для переключения нужен журнал: --report-file=/secure/gateway-selection.json");
}

function databaseUrl() {
  const explicit = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (explicit && !explicit.includes("${")) return explicit.trim();
  return `postgresql://${encodeURIComponent(process.env.POSTGRES_USERNAME || "postgres")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DATABASE || "shadow_proxy"}`;
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

function tcp(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host, port });
    const done = (ok) => { socket.destroy(); resolve({ ok, ms: Date.now() - started }); };
    socket.setTimeout(timeout);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function authenticatedHealth(server) {
  if (!server.token) return { ok: false, ms: null, detail: "нет auth token" };
  const started = Date.now();
  try {
    const response = await axios.get(`http://${server.host}:808/health`, {
      headers: { Authorization: `Bearer ${server.token}` },
      timeout: 3000,
      validateStatus: () => true,
    });
    const ok = response.status === 200 && response.data?.status === "ok";
    return { ok, ms: Date.now() - started, detail: ok ? `active=${Number(response.data?.count || 0)}` : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, detail: error?.code || error?.message || "health failed" };
  }
}

function liveProxyTest(server, proxy) {
  if (!proxy?.userLogin || !proxy?.userPassword) return { ok: false, detail: "нет тестового ACTIVE-прокси" };
  const escapeConfig = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const curlConfig = [
    `proxy = "http://${escapeConfig(server.host)}:10000"`,
    `proxy-user = "${escapeConfig(proxy.userLogin)}:${escapeConfig(proxy.userPassword)}"`,
  ].join("\n");
  const result = spawnSync(
    "curl",
    ["--config", "-", "-sS", "--max-time", "20", "-o", "/dev/null", "-w", "%{http_code} %{time_total}", "https://api.ipify.org"],
    { encoding: "utf8", input: curlConfig },
  );
  const [code, seconds] = (result.stdout || "").trim().split(/\s+/);
  return { ok: result.status === 0 && code === "200", detail: result.status === 0 ? `HTTP ${code}, ${seconds || "?"}s` : (result.stderr || "curl failed").trim().slice(0, 180) };
}

async function main() {
  const servers = await prisma.proxyServer.findMany({ orderBy: { host: "asc" } });
  const report = [];
  for (const server of servers) {
    const [proxyPort, controlHealth, sample] = await Promise.all([
      tcp(server.host, 10000),
      authenticatedHealth(server),
      prisma.proxy.findFirst({ where: { serverHost: server.host, status: "ACTIVE", userLogin: { not: null }, userPassword: { not: null } }, orderBy: { updatedAt: "desc" } }),
    ]);
    const live = proxyPort.ok ? liveProxyTest(server, sample) : { ok: false, detail: "порт 10000 недоступен" };
    const row = {
      host: server.host,
      status: server.status,
      proxy10000: proxyPort,
      controlHealth,
      live,
      sampleId: sample?.id || null,
      trafficBefore: sample ? String(sample.trafficUsed || "0") : null,
      accounting: { ok: false, detail: live.ok ? "ожидание отчёта агента" : "live-тест не пройден" },
    };
    report.push(row);
    console.log(`${row.host} db=${row.status} 10000=${proxyPort.ok ? `${proxyPort.ms}ms` : "FAIL"} health=${controlHealth.ok ? `${controlHealth.ms}ms ${controlHealth.detail}` : `FAIL ${controlHealth.detail}`} live=${live.ok ? "OK" : "FAIL"} (${live.detail})`);
  }

  if (report.some((row) => row.live.ok && row.sampleId)) {
    // Агент отправляет дельты каждые 5 секунд; даём время CORE записать отчёт.
    await wait(8000);
    for (const row of report) {
      if (!row.live.ok || !row.sampleId || row.trafficBefore === null) continue;
      const fresh = await prisma.proxy.findUnique({ where: { id: row.sampleId }, select: { trafficUsed: true } });
      const after = BigInt(fresh?.trafficUsed || "0");
      const delta = after - BigInt(row.trafficBefore);
      row.accounting = delta > 0n
        ? { ok: true, detail: `+${delta} bytes` }
        : { ok: false, detail: "trafficUsed не изменился после контрольного запроса" };
      console.log(`${row.host} accounting=${row.accounting.ok ? "OK" : "FAIL"} (${row.accounting.detail})`);
    }
  }

  const auditReport = {
    version: 1,
    createdAt: new Date().toISOString(),
    execute,
    keep: keep || null,
    servers: report,
  };
  if (reportFile) writePrivateJson(reportFile, auditReport);

  if (!execute) {
    console.log("[DRY-RUN] Для переключения: node scripts/gateway-audit.js --execute --confirm=GATEWAY_SINGLE_NODE --keep=<рабочий-IP> --report-file=/secure/gateway-selection.json");
    return;
  }
  if (!keep) throw new Error("Нужен --keep=<host>");
  const selected = report.find((row) => row.host === keep);
  if (!selected) throw new Error(`Сервер ${keep} не найден в БД`);
  if (!force && (!selected.proxy10000.ok || !selected.controlHealth.ok || !selected.live.ok || !selected.accounting.ok)) {
    throw new Error(`Сервер ${keep} не прошёл проверку; исправьте его или добавьте осознанный --force`);
  }
  await prisma.$transaction([
    prisma.proxyServer.updateMany({ where: { host: keep }, data: { status: "ACTIVE" } }),
    prisma.proxyServer.updateMany({ where: { host: { not: keep } }, data: { status: "OFFLINE" } }),
  ]);
  if (reportFile) {
    auditReport.finishedAt = new Date().toISOString();
    auditReport.result = { activeHost: keep, forced: force };
    writePrivateJson(reportFile, auditReport);
  }
  console.log(`[OK] Для новых генераций оставлен один ACTIVE gateway: ${keep}. Существующие прокси и записи не удалялись.`);
}

main().catch((error) => { console.error(`[gateway-audit] ${error.message}`); process.exitCode = 1; }).finally(() => prisma.$disconnect());
