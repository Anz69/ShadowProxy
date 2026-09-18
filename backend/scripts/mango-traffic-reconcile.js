#!/usr/bin/env node

/**
 * Сверка трафика сайта и Mango без изменения локальных балансов.
 *
 *   node scripts/mango-traffic-reconcile.js audit
 *   node scripts/mango-traffic-reconcile.js zero --execute --confirm=MANGO_ZERO
 *     --confirm-scope=ALL_MANGO_ACCOUNTS --usernames-file=/secure/all.txt
 *     --report-file=/secure/mango-zero.json
 *   node scripts/mango-traffic-reconcile.js restore --execute --confirm=MANGO_RESTORE
 *     --report-file=/secure/mango-restore.json
 *
 * zero делает add_user_flow с отрицательным текущим last_flow и затем проверяет 0.
 * restore доводит Mango до premiumTrafficLeft из БД (дельтой), поэтому повторный
 * запуск безопасен. Дополнительные Mango-логины можно передать через --usernames-file.
 */

const path = require("path");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const {
  buildTargets,
  readUsernameManifest,
  writePrivateJson,
} = require("./lib/mango-reconcile-core");

const envPath = path.resolve(__dirname, "..", ".env");
require("dotenv").config({ path: envPath, override: false });

const args = process.argv.slice(2);
const mode = args.find((arg) => !arg.startsWith("--")) || "audit";
const execute = args.includes("--execute");
const confirm = args.find((arg) => arg.startsWith("--confirm="))?.split("=").slice(1).join("=");
const usernamesFile = args.find((arg) => arg.startsWith("--usernames-file="))?.split("=").slice(1).join("=");
const scopeConfirmation = args.find((arg) => arg.startsWith("--confirm-scope="))?.split("=").slice(1).join("=");
const reportFile = args.find((arg) => arg.startsWith("--report-file="))?.split("=").slice(1).join("=");

if (!["audit", "zero", "restore"].includes(mode)) {
  throw new Error("Режим: audit | zero | restore");
}
if (execute && mode === "audit") {
  throw new Error("audit — только режим чтения; уберите --execute");
}
const expectedConfirmation = mode === "zero" ? "MANGO_ZERO" : "MANGO_RESTORE";
if (execute && confirm !== expectedConfirmation) {
  throw new Error(`Для выполнения ${mode} добавьте --confirm=${expectedConfirmation}`);
}
if (usernamesFile && mode !== "zero") {
  throw new Error("--usernames-file разрешён только для zero: для внешних аккаунтов сайт не знает баланс восстановления");
}
if (execute && !reportFile) {
  throw new Error("Для выполнения нужен приватный журнал: --report-file=/secure/mango-<operation>.json");
}
if (execute && mode === "zero") {
  if (!usernamesFile) {
    throw new Error("Обнуление запрещено без полного --usernames-file, экспортированного из Mango");
  }
  if (scopeConfirmation !== "ALL_MANGO_ACCOUNTS") {
    throw new Error("Подтвердите полноту manifest: --confirm-scope=ALL_MANGO_ACCOUNTS");
  }
}

function databaseUrl() {
  const explicit = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (explicit && !explicit.includes("${")) return explicit.trim();
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || "5432";
  const user = process.env.POSTGRES_USERNAME || "postgres";
  const password = process.env.POSTGRES_PASSWORD || "";
  const database = process.env.POSTGRES_DATABASE || "shadow_proxy";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
const baseURL = process.env.MANGO_PROXY_BASE_URL;
const appKey = process.env.MANGO_PROXY_API_KEY;
if (!baseURL || !appKey) throw new Error("Нужны MANGO_PROXY_BASE_URL и MANGO_PROXY_API_KEY");

const api = axios.create({ baseURL, timeout: 30_000, validateStatus: () => true });
async function mangoPost(endpoint, data) {
  const response = await api.post(endpoint, { ...data, app_key: appKey });
  if (response.status < 200 || response.status >= 300 || typeof response.data === "string") {
    throw new Error(`${endpoint}: HTTP ${response.status}`);
  }
  if (response.data?.code != null && !["0", "1", 0, 1, 200].includes(response.data.code)) {
    throw new Error(`${endpoint}: ${response.data.msg || `code=${response.data.code}`}`);
  }
  return response.data;
}

async function getFlow(username) {
  const data = await mangoPost("/user_info", { username });
  const rawValue = data?.ret_data?.last_flow ?? data?.data?.last_flow;
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    throw new Error(`/user_info: Mango не вернул last_flow для ${username}`);
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) throw new Error(`/user_info: некорректный last_flow для ${username}`);
  return Math.max(0, Math.ceil(value));
}

async function main() {
  const users = await prisma.user.findMany({
    where: { premiumUsername: { not: "" } },
    select: { id: true, email: true, premiumUsername: true, premiumTrafficLeft: true },
    orderBy: { id: "asc" },
  });

  let manifest = null;
  if (usernamesFile) {
    manifest = readUsernameManifest(usernamesFile);
  }
  const targets = buildTargets(users, manifest?.usernames || null);

  const report = {
    version: 1,
    operation: mode,
    execute,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    manifest: manifest ? { path: manifest.resolved, count: manifest.usernames.size } : null,
    databaseAccounts: users.length,
    totalAccounts: targets.size,
    preflightPassed: false,
    entries: [],
    summary: null,
  };
  const persistReport = () => reportFile && writePrivateJson(reportFile, report);

  console.log(`[Mango] mode=${mode} execute=${execute} accounts=${targets.size}`);
  if (mode === "zero" && !usernamesFile) {
    console.warn("[Mango] ВНИМАНИЕ: без --usernames-file покрываются все Mango-аккаунты, связанные с пользователями сайта; внешние аккаунты в БД неизвестны.");
  }

  // Fail-closed preflight: до первого изменения должны читаться абсолютно все цели.
  const currentByUsername = new Map();
  const preflightFailures = [];
  for (const [username, item] of targets) {
    try {
      const currentMb = await getFlow(username);
      currentByUsername.set(username, currentMb);
      report.entries.push({ username, userId: item.userId, source: item.source, currentMb, targetMb: mode === "zero" ? 0 : item.targetMb, status: "preflight-ok" });
    } catch (error) {
      preflightFailures.push({ username, error: error.message });
      report.entries.push({ username, userId: item.userId, source: item.source, status: "preflight-failed", error: error.message });
      console.error(`[PREFLIGHT FAIL] ${username}: ${error.message}`);
    }
  }
  if (preflightFailures.length) {
    report.finishedAt = new Date().toISOString();
    report.summary = { changed: 0, unchanged: 0, failed: preflightFailures.length, abortedBeforeMutation: true };
    persistReport();
    throw new Error(`Preflight не пройден для ${preflightFailures.length} аккаунтов; изменения не выполнялись`);
  }
  report.preflightPassed = true;
  persistReport();

  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  let totalCurrent = 0;
  let totalTarget = 0;
  for (const [username, item] of targets) {
    try {
      const currentMb = currentByUsername.get(username);
      const targetMb = mode === "zero" ? 0 : item.targetMb;
      totalCurrent += currentMb;
      totalTarget += targetMb;
      const delta = targetMb - currentMb;
      if (mode === "audit" || delta === 0) {
        unchanged++;
        console.log(`[Mango] ${username}: current=${currentMb}MB target=${item.targetMb}MB delta=${item.targetMb - currentMb}MB`);
        const entry = report.entries.find((value) => value.username === username);
        Object.assign(entry, { status: delta === 0 ? "unchanged" : "audited", deltaMb: targetMb - currentMb });
        persistReport();
        continue;
      }
      if (!execute) {
        console.log(`[DRY-RUN] ${username}: ${currentMb}MB -> ${targetMb}MB (delta ${delta}MB)`);
        changed++;
        const entry = report.entries.find((value) => value.username === username);
        Object.assign(entry, { status: "would-change", deltaMb: delta });
        persistReport();
        continue;
      }
      await mangoPost("/add_user_flow", { username, flow: delta });
      const verifiedMb = await getFlow(username);
      if (Math.abs(verifiedMb - targetMb) > 1) throw new Error(`проверка не сошлась: expected=${targetMb}, actual=${verifiedMb}`);
      changed++;
      console.log(`[OK] ${username}: ${currentMb}MB -> ${verifiedMb}MB`);
      const entry = report.entries.find((value) => value.username === username);
      Object.assign(entry, { status: "changed", deltaMb: delta, verifiedMb });
      persistReport();
    } catch (error) {
      failed++;
      console.error(`[FAIL] ${username}: ${error.message}`);
      const entry = report.entries.find((value) => value.username === username);
      Object.assign(entry, { status: "failed", error: error.message });
      persistReport();
    }
  }

  console.log(`[Mango] done changed=${changed} unchanged=${unchanged} failed=${failed} totalCurrent=${totalCurrent}MB totalTarget=${totalTarget}MB`);
  report.finishedAt = new Date().toISOString();
  report.summary = { changed, unchanged, failed, totalCurrentMb: totalCurrent, totalTargetMb: totalTarget, abortedBeforeMutation: false };
  const savedReport = persistReport();
  if (savedReport) console.log(`[Mango] report=${savedReport}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[mango-reconcile] ${error.message}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
