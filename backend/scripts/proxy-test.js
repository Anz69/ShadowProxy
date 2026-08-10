#!/usr/bin/env node
/**
 * Локальный тестер прокси (пачками). Берёт уже сгенерированные прокси из БД и меряет по
 * каждому ЛАТЕНСИ (ms) и ПРОПУСКНУЮ СПОСОБНОСТЬ (Mbps, download) через наш гейтвей —
 * ту самую цепочку клиент→гейтвей→апстрим, что и у реального юзера.
 *
 * Запуск (CommonJS, без ts-node — работает в прод-контейнере):
 *   docker compose exec backend node scripts/proxy-test.js [опции]
 *   npm run script:proxy-test -- [опции]
 *
 * Опции (все необязательны):
 *   --type <ProxyType>     фильтр по типу (ISP_USA | ISP_EU | RESIDENTIAL_LITE | RESIDENT_PREMIUM | …)
 *   --country <ISO2>       фильтр по стране (напр. US, DE) — регистр не важен
 *   --status <ProxyStatus> статус (по умолчанию ACTIVE)
 *   --server <host>        фильтр по serverHost гейтвея
 *   --user <userId>        фильтр по пользователю
 *   --package <id>         фильтр по userPackageId
 *   --limit <N>            сколько прокси тестировать (по умолчанию 50)
 *   --concurrency <N>      параллельность (по умолчанию 10)
 *   --size <MB>            размер файла для замера скорости (по умолчанию 10)
 *   --url <url>            свой URL для замера скорости
 *   --latency-url <url>    URL для замера латенси (по умолчанию https://api.ipify.org)
 *   --out <file.csv>       выгрузить результаты в CSV
 *   --raw                  дополнительно тестировать сырой апстрим (host:port) — диагностика
 */

const path = require("path");
const { writeFileSync } = require("fs");
try {
    require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), override: false });
} catch (_) {
    /* в контейнере env приходит из docker env_file — dotenv опционален */
}
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

// URL БД: берём POSTGRES_URI, а если он с неразвёрнутыми ${…} или пуст — собираем из компонентов.
function resolveDbUrl() {
    let url = process.env.POSTGRES_URI || process.env.DATABASE_URL || "";
    if (!url || url.includes("${")) {
        const u = process.env.POSTGRES_USERNAME || "postgres";
        const p = process.env.POSTGRES_PASSWORD || "";
        const h = process.env.POSTGRES_HOST || "localhost";
        const port = process.env.POSTGRES_PORT || "5432";
        const db = process.env.POSTGRES_DATABASE || "shadow_proxy";
        url = `postgresql://${u}:${p}@${h}:${port}/${db}`;
    }
    return url;
}

const prisma = new PrismaClient({ datasources: { db: { url: resolveDbUrl() } } });

// ── аргументы ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith("--")) continue;
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) {
            out[key] = true;
        } else {
            out[key] = next;
            i++;
        }
    }
    return out;
}
const args = parseArgs(process.argv.slice(2));
const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : def;
};

const LIMIT = num(args.limit, 50);
const CONCURRENCY = num(args.concurrency, 10);
const SIZE_MB = num(args.size, 10);
const LATENCY_URL = typeof args["latency-url"] === "string" ? args["latency-url"] : "https://api.ipify.org";
const DOWNLOAD_URL =
    typeof args.url === "string" ? args.url : `https://speed.cloudflare.com/__down?bytes=${Math.round(SIZE_MB * 1_000_000)}`;
const TEST_RAW = !!args.raw;

// ── утилиты ──────────────────────────────────────────────────────────────────
function chunks(arr, size) {
    const res = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
}
function shortErr(e) {
    if (e && typeof e === "object") {
        if (e.response && e.response.status) return `http ${e.response.status}`;
        if (e.code) return String(e.code);
        if (e.message) return String(e.message).slice(0, 60);
    }
    return String(e).slice(0, 60);
}
function median(nums) {
    const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : +((a[mid - 1] + a[mid]) / 2).toFixed(2);
}
function avg(nums) {
    const a = nums.filter((n) => Number.isFinite(n));
    return a.length ? +(a.reduce((s, n) => s + n, 0) / a.length).toFixed(2) : null;
}

// Латенси: 3 быстрых GET через прокси, минимум; заодно exit-IP (тело ipify).
async function measureLatency(proxyUrl) {
    const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });
    let best = Infinity;
    let exitIp = "";
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        try {
            const res = await axios.get(LATENCY_URL, {
                httpsAgent: agent,
                proxy: false,
                timeout: 15_000,
                responseType: "text",
                validateStatus: () => true,
                headers: { "User-Agent": "ShadowProxy-Tester/1.0" },
            });
            const ms = Date.now() - t0;
            if (res.status >= 200 && res.status < 400) {
                best = Math.min(best, ms);
                if (!exitIp && typeof res.data === "string") exitIp = res.data.trim().slice(0, 45);
            } else {
                lastErr = { response: { status: res.status } };
            }
        } catch (e) {
            lastErr = e;
        }
    }
    if (best === Infinity) throw lastErr || new Error("latency failed");
    return { ms: best, exitIp };
}

// Скорость: скачать фикс-файл через прокси, посчитать Mbps.
async function measureBandwidth(proxyUrl) {
    const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });
    const t0 = Date.now();
    const res = await axios.get(DOWNLOAD_URL, {
        httpsAgent: agent,
        proxy: false,
        timeout: 60_000,
        responseType: "arraybuffer",
        validateStatus: () => true,
        maxRedirects: 3,
        headers: { "User-Agent": "ShadowProxy-Tester/1.0" },
    });
    if (res.status < 200 || res.status >= 400) throw { response: { status: res.status } };
    const bytes = res.data.byteLength || res.data.length || 0;
    const sec = (Date.now() - t0) / 1000;
    if (sec <= 0 || bytes <= 0) return 0;
    return +((bytes * 8) / (sec * 1_000_000)).toFixed(2);
}

async function testOne(idx, p) {
    const base = {
        idx,
        serverHost: p.serverHost || "",
        login: p.userLogin || "",
        type: p.type || "",
        country: p.country || "",
        exitIp: "",
        latencyMs: null,
        mbps: null,
        status: "fail",
        error: "",
        rawStatus: TEST_RAW ? "" : undefined,
    };

    if (!p.serverHost || !p.userPort || !p.userLogin || !p.userPassword) {
        base.error = "нет клиентских кредов (serverHost/userPort/userLogin/userPassword)";
        return base;
    }

    const proxyUrl = `http://${encodeURIComponent(p.userLogin)}:${encodeURIComponent(p.userPassword)}@${p.serverHost}:${p.userPort}`;

    try {
        const { ms, exitIp } = await measureLatency(proxyUrl);
        base.latencyMs = ms;
        base.exitIp = exitIp;
        try {
            base.mbps = await measureBandwidth(proxyUrl);
        } catch (e) {
            base.error = `bandwidth: ${shortErr(e)}`;
        }
        base.status = "ok";
    } catch (e) {
        base.error = shortErr(e);
    }

    if (TEST_RAW && p.host && p.port && p.username) {
        const rawUrl = `http://${encodeURIComponent(p.username)}:${encodeURIComponent(p.password || "")}@${p.host}:${p.port}`;
        try {
            await measureLatency(rawUrl);
            base.rawStatus = "ok";
        } catch (_) {
            base.rawStatus = "fail";
        }
    }

    return base;
}

async function main() {
    const where = { status: typeof args.status === "string" ? args.status : "ACTIVE" };
    if (typeof args.type === "string") where.type = args.type;
    if (typeof args.country === "string") where.country = args.country.toUpperCase();
    if (typeof args.server === "string") where.serverHost = args.server;
    if (typeof args.user === "string") where.userId = args.user;
    if (typeof args.package === "string") where.userPackageId = args.package;

    const proxies = await prisma.proxy.findMany({ where, take: LIMIT, orderBy: { createdAt: "desc" } });
    if (!proxies.length) {
        console.log("Прокси по фильтру не найдено:", JSON.stringify(where));
        await prisma.$disconnect();
        process.exit(0);
    }

    console.log(
        `Тестирую ${proxies.length} прокси | concurrency=${CONCURRENCY} | latency→${LATENCY_URL} | download→${SIZE_MB}MB${TEST_RAW ? " | +raw upstream" : ""}\n`,
    );

    const rows = [];
    let i = 0;
    for (const batch of chunks(proxies, CONCURRENCY)) {
        const settled = await Promise.allSettled(batch.map((p) => testOne(++i, p)));
        for (const s of settled) if (s.status === "fulfilled") rows.push(s.value);
    }
    rows.sort((a, b) => a.idx - b.idx);

    console.table(
        rows.map((r) => ({
            "#": r.idx,
            server: r.serverHost,
            login: r.login.length > 40 ? r.login.slice(0, 37) + "…" : r.login,
            type: r.type,
            country: r.country,
            exitIp: r.exitIp,
            "latency,ms": r.latencyMs != null ? r.latencyMs : "—",
            mbps: r.mbps != null ? r.mbps : "—",
            status: r.status,
            ...(TEST_RAW ? { raw: r.rawStatus || "—" } : {}),
            error: r.error,
        })),
    );

    const ok = rows.filter((r) => r.status === "ok");
    const lat = ok.map((r) => r.latencyMs).filter((n) => n != null);
    const bw = ok.map((r) => r.mbps).filter((n) => n != null);
    console.log(
        `\nИтого: ok=${ok.length}/${rows.length} | латенси avg=${avg(lat) != null ? avg(lat) : "—"}ms median=${median(lat) != null ? median(lat) : "—"}ms | скорость avg=${avg(bw) != null ? avg(bw) : "—"}Mbps median=${median(bw) != null ? median(bw) : "—"}Mbps`,
    );

    const groups = new Map();
    for (const r of rows) {
        const k = `${r.type || "?"} / ${r.country || "?"}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
    }
    console.log("\nПо типу/стране:");
    for (const [k, g] of groups) {
        const gok = g.filter((r) => r.status === "ok");
        const gl = median(gok.map((r) => r.latencyMs).filter((n) => n != null));
        const gb = median(gok.map((r) => r.mbps).filter((n) => n != null));
        console.log(`  ${k}: ok=${gok.length}/${g.length} | латенси median=${gl != null ? gl : "—"}ms | скорость median=${gb != null ? gb : "—"}Mbps`);
    }

    if (typeof args.out === "string") {
        const header = ["idx", "serverHost", "login", "type", "country", "exitIp", "latencyMs", "mbps", "status", "rawStatus", "error"];
        const csv = [
            header.join(","),
            ...rows.map((r) =>
                [r.idx, r.serverHost, r.login, r.type, r.country, r.exitIp, r.latencyMs != null ? r.latencyMs : "", r.mbps != null ? r.mbps : "", r.status, r.rawStatus || "", `"${r.error.replace(/"/g, "'")}"`].join(","),
            ),
        ].join("\n");
        writeFileSync(args.out, csv, "utf-8");
        console.log(`\nCSV записан: ${args.out}`);
    }

    await prisma.$disconnect();
    process.exit(ok.length ? 0 : 1);
}

main().catch(async (e) => {
    console.error("Fatal:", e);
    try {
        await prisma.$disconnect();
    } catch (_) {}
    process.exit(2);
});
