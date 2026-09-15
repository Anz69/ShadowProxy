#!/usr/bin/env node

/**
 * Сверка трафика сайта и Mango без изменения локальных балансов.
 *
 *   node scripts/mango-traffic-reconcile.js audit
 *   node scripts/mango-traffic-reconcile.js zero --execute --confirm=MANGO_ZERO
 *   node scripts/mango-traffic-reconcile.js restore --execute --confirm=MANGO_RESTORE
 *
 * zero делает add_user_flow с отрицательным текущим last_flow и затем проверяет 0.
 * restore доводит Mango до premiumTrafficLeft из БД (дельтой), поэтому повторный
 * запуск безопасен. Дополнительные Mango-логины можно передать через --usernames-file.
 */

const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");

const envPath = path.resolve(__dirname, "..", ".env");
require("dotenv").config({ path: envPath, override: false });

const args = process.argv.slice(2);
const mode = args.find((arg) => !arg.startsWith("--")) || "audit";
const execute = args.includes("--execute");
const confirm = args.find((arg) => arg.startsWith("--confirm="))?.split("=").slice(1).join("=");
const usernamesFile = args.find((arg) => arg.startsWith("--usernames-file="))?.split("=").slice(1).join("=");

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
  const value = Number(data?.ret_data?.last_flow ?? data?.data?.last_flow ?? 0);
  if (!Number.isFinite(value)) throw new Error(`/user_info: некорректный last_flow для ${username}`);
  return Math.max(0, Math.ceil(value));
}

function bytesToMb(value) {
  const bytes = BigInt(value || "0");
  return Number((bytes + 1024n ** 2n - 1n) / (1024n ** 2n));
}

async function main() {
  const users = await prisma.user.findMany({
    where: { premiumUsername: { not: "" } },
    select: { id: true, email: true, premiumUsername: true, premiumTrafficLeft: true },
    orderBy: { id: "asc" },
  });

  const targets = new Map();
  for (const user of users) {
    const username = (user.premiumUsername || "").split(":")[0].trim();
    if (username) targets.set(username, { user, targetMb: bytesToMb(user.premiumTrafficLeft) });
  }
  if (usernamesFile) {
    const lines = fs.readFileSync(path.resolve(usernamesFile), "utf8").split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
    for (const username of lines) if (!targets.has(username)) targets.set(username, { user: null, targetMb: 0 });
  }

  console.log(`[Mango] mode=${mode} execute=${execute} accounts=${targets.size}`);
  if (mode === "zero" && !usernamesFile) {
    console.warn("[Mango] ВНИМАНИЕ: без --usernames-file покрываются все Mango-аккаунты, связанные с пользователями сайта; внешние аккаунты в БД неизвестны.");
  }

  let changed = 0;
  let unchanged = 0;
  let failed = 0;
  let totalCurrent = 0;
  let totalTarget = 0;
  for (const [username, item] of targets) {
    try {
      const currentMb = await getFlow(username);
      const targetMb = mode === "zero" ? 0 : item.targetMb;
      totalCurrent += currentMb;
      totalTarget += targetMb;
      const delta = targetMb - currentMb;
      if (mode === "audit" || delta === 0) {
        unchanged++;
        console.log(`[Mango] ${username}: current=${currentMb}MB target=${item.targetMb}MB delta=${item.targetMb - currentMb}MB`);
        continue;
      }
      if (!execute) {
        console.log(`[DRY-RUN] ${username}: ${currentMb}MB -> ${targetMb}MB (delta ${delta}MB)`);
        changed++;
        continue;
      }
      await mangoPost("/add_user_flow", { username, flow: delta });
      const verifiedMb = await getFlow(username);
      if (Math.abs(verifiedMb - targetMb) > 1) throw new Error(`проверка не сошлась: expected=${targetMb}, actual=${verifiedMb}`);
      changed++;
      console.log(`[OK] ${username}: ${currentMb}MB -> ${verifiedMb}MB`);
    } catch (error) {
      failed++;
      console.error(`[FAIL] ${username}: ${error.message}`);
    }
  }

  console.log(`[Mango] done changed=${changed} unchanged=${unchanged} failed=${failed} totalCurrent=${totalCurrent}MB totalTarget=${totalTarget}MB`);
  if (failed) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
