#!/usr/bin/env node

/**
 * Неразрушающий smoke новых upstream через единственный ACTIVE gateway.
 * Временно добавляет QA-логины в agent registry, делает HTTPS-запрос и удаляет их.
 * БД, пользовательские пакеты и балансы не изменяет.
 */

const path = require("path");
const { randomBytes } = require("crypto");
const { spawnSync } = require("child_process");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), override: false });

function databaseUrl() {
  const explicit = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (explicit && !explicit.includes("${")) return explicit.trim();
  return `postgresql://${encodeURIComponent(process.env.POSTGRES_USERNAME || "postgres")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DATABASE || "shadow_proxy"}`;
}

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Не задан ${name}`);
  return value;
}

function port(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name}: некорректный порт`);
  return value;
}

const targets = [
  {
    type: "ISP_NL",
    host: process.env.FLASH_ISP_EU_HOST || "eu-isp.flashproxy.io",
    port: port("FLASH_ISP_EU_HTTP_PORT", 30),
    username: `${required("FLASH_ISP_EU_USERNAME")}-country-NL`,
    password: required("FLASH_ISP_EU_PASSWORD"),
  },
  {
    type: "ISP_USA",
    host: process.env.FLASH_ISP_USA_HOST || "beta.flashproxy.io",
    port: port("FLASH_ISP_USA_HTTP_PORT", 30),
    username: `${required("FLASH_ISP_USA_USERNAME")}-country-US`,
    password: required("FLASH_ISP_USA_PASSWORD"),
  },
  {
    type: "RESIDENTIAL_LITE",
    host: process.env.FLASH_RESIDENTIAL_LITE_HOST || "lite.flashproxy.io",
    port: port("FLASH_RESIDENTIAL_LITE_HTTP_PORT", 6969),
    username: `${required("FLASH_RESIDENTIAL_LITE_USERNAME")}-country-ES`,
    password: required("FLASH_RESIDENTIAL_LITE_PASSWORD"),
  },
];

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

function curlThroughGateway(host, login, password) {
  const configValue = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, "");
  const config = [
    `proxy = "http://${configValue(host)}:10000"`,
    `proxy-user = "${configValue(login)}:${configValue(password)}"`,
  ].join("\n");
  const result = spawnSync("curl", [
    "--config", "-", "-sS", "--max-time", "30", "-o", "/dev/null",
    "-w", "%{http_code} %{time_total} %{size_download} %{speed_download}",
    "https://speed.cloudflare.com/__down?bytes=100000",
  ], { encoding: "utf8", input: config });
  const [code, seconds, bytes, bytesPerSecond] = String(result.stdout || "").trim().split(/\s+/);
  return {
    ok: result.status === 0 && code === "200" && Number(bytes) >= 90_000,
    code: code || "000",
    seconds: Number(seconds || 0),
    bytes: Number(bytes || 0),
    mbps: Number(bytesPerSecond || 0) * 8 / 1_000_000,
    error: result.status === 0 ? "" : String(result.stderr || "curl failed").trim().slice(0, 160),
  };
}

async function main() {
  const active = await prisma.proxyServer.findMany({ where: { status: "ACTIVE", token: { not: null } } });
  if (active.length !== 1) throw new Error(`Ожидался ровно один ACTIVE gateway, найдено: ${active.length}`);
  const server = active[0];
  const results = [];

  for (const target of targets) {
    const suffix = randomBytes(8).toString("hex");
    const login = `qa-sprint3-${target.type.toLowerCase()}-${suffix}`;
    const password = randomBytes(12).toString("base64url");
    try {
      await axios.post(`http://${server.host}:808/add-port`, {
        port: 10000,
        user_id: "release-smoke",
        login,
        password,
        proxy_host: target.host,
        proxy_port: target.port,
        proxy_username: target.username,
        proxy_password: target.password,
      }, { headers: { Authorization: `Bearer ${server.token}` }, timeout: 5000 });

      const measured = curlThroughGateway(server.host, login, password);
      results.push({ type: target.type, ...measured });
      console.log(`${target.type}: ${measured.ok ? "OK" : "FAIL"} HTTP=${measured.code} time=${measured.seconds.toFixed(3)}s size=${measured.bytes} speed=${measured.mbps.toFixed(2)}Mbps${measured.error ? ` error=${measured.error}` : ""}`);
    } finally {
      await axios.post(`http://${server.host}:808/block-login`, { login }, {
        headers: { Authorization: `Bearer ${server.token}` },
        timeout: 5000,
      }).catch(() => undefined);
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`[gateway-smoke] passed=${results.length - failed.length}/${results.length} gateway=${server.host}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[gateway-smoke] ${error.message}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
