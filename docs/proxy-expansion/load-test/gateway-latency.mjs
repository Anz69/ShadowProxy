#!/usr/bin/env node
/**
 * Замер задержки прокси-гейтвея (ТЗ 7.2 / 7.4).
 * Открывает N последовательных/параллельных HTTP CONNECT-туннелей через гейтвей и
 * меряет: время до установления туннеля (CONNECT 2xx) и время до первого байта от
 * целевого хоста. Сравните с прямым соединением к апстриму, чтобы получить «накладные».
 *
 * Запуск (node 18+, без зависимостей):
 *   GW_HOST=1.2.3.4 GW_PORT=10000 GW_LOGIN='package-…-user-…' GW_PASS='…' \
 *   TARGET=example.com:443 N=200 CONCURRENCY=20 node gateway-latency.mjs
 *
 * Для «прямого» сравнения укажите апстрим как гейтвей (GW_HOST=апстрим, его креды).
 */
import net from "node:net";

const GW_HOST = process.env.GW_HOST || "127.0.0.1";
const GW_PORT = Number(process.env.GW_PORT || 10000);
const GW_LOGIN = process.env.GW_LOGIN || "";
const GW_PASS = process.env.GW_PASS || "";
const TARGET = process.env.TARGET || "example.com:443";
const N = Number(process.env.N || 100);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);

const auth = "Basic " + Buffer.from(`${GW_LOGIN}:${GW_PASS}`).toString("base64");

function once() {
    return new Promise((resolve) => {
        const t0 = process.hrtime.bigint();
        let connectMs = null;
        const sock = net.connect(GW_PORT, GW_HOST);
        sock.setTimeout(15000);
        sock.on("connect", () => {
            sock.write(
                `CONNECT ${TARGET} HTTP/1.1\r\nHost: ${TARGET}\r\nProxy-Authorization: ${auth}\r\nConnection: keep-alive\r\n\r\n`,
            );
        });
        let buf = "";
        sock.on("data", (d) => {
            if (connectMs === null) {
                buf += d.toString("latin1");
                if (buf.includes("\r\n\r\n")) {
                    const ok = /^HTTP\/1\.\d (2\d\d)/.test(buf);
                    connectMs = Number(process.hrtime.bigint() - t0) / 1e6;
                    sock.destroy();
                    resolve({ ok, connectMs });
                }
            }
        });
        sock.on("timeout", () => { sock.destroy(); resolve({ ok: false, connectMs: null, err: "timeout" }); });
        sock.on("error", (e) => resolve({ ok: false, connectMs: null, err: e.message }));
    });
}

function pct(arr, p) {
    if (!arr.length) return NaN;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

const results = [];
let idx = 0;
async function worker() {
    while (idx < N) {
        idx++;
        results.push(await once());
    }
}

console.log(`Gateway latency: ${GW_HOST}:${GW_PORT} → ${TARGET} | N=${N} concurrency=${CONCURRENCY}`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const ok = results.filter((r) => r.ok);
const fails = results.length - ok.length;
const lat = ok.map((r) => r.connectMs);
console.log(`OK: ${ok.length}/${results.length} (fails: ${fails})`);
console.log(
    `CONNECT latency ms — avg ${(lat.reduce((a, b) => a + b, 0) / (lat.length || 1)).toFixed(1)} | ` +
        `p50 ${pct(lat, 50)?.toFixed(1)} | p95 ${pct(lat, 95)?.toFixed(1)} | p99 ${pct(lat, 99)?.toFixed(1)} | max ${Math.max(...lat).toFixed(1)}`,
);
if (fails) {
    const sample = results.find((r) => !r.ok);
    console.log(`first failure: ${sample?.err || "non-2xx CONNECT"}`);
}
