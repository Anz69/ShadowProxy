/**
 * Нагрузочный тест CORE API (ТЗ 7.3 / 7.4): массовая активация триала и генерация
 * прокси под параллельной нагрузкой. Меряет p95 времени ответа и долю ошибок.
 *
 * Требует k6 (https://k6.io). Запуск:
 *   BASE=https://dev.shadowproxy.io \
 *   TOKEN='<session-cookie-или-bearer>' \
 *   PACKAGE_ID='<uuid пакета для генерации>' \
 *   k6 run api-load.k6.js
 *
 * VU/длительность регулируются через --vus / --duration или ниже в options.
 * ВАЖНО: гонять только на dev/stage. Триал одноразовый — для честного замера
 * времени создания пакета используйте сценарий generate (см. ниже) на готовом пакете.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:3000";
const TOKEN = __ENV.TOKEN || "";
const PACKAGE_ID = __ENV.PACKAGE_ID || "";

const genTrend = new Trend("proxy_generate_ms", true);
const genErr = new Rate("proxy_generate_errors");

export const options = {
    scenarios: {
        generate: {
            executor: "ramping-vus",
            startVUs: 1,
            stages: [
                { duration: "30s", target: 20 }, // разгон
                { duration: "1m", target: 20 },  // плато
                { duration: "15s", target: 0 },  // спад
            ],
        },
    },
    thresholds: {
        proxy_generate_ms: ["p(95)<2000"], // цель ТЗ 7.1: ≤1–2с
        proxy_generate_errors: ["rate<0.02"],
        http_req_failed: ["rate<0.02"],
    },
};

const headers = {
    "Content-Type": "application/json",
    ...(TOKEN.includes("=") ? { Cookie: TOKEN } : { Authorization: `Bearer ${TOKEN}` }),
};

export default function () {
    // Генерация одного BY_TIME-прокси — горячий путь из 7.1.
    const res = http.post(
        `${BASE}/api/package/${PACKAGE_ID}/generate`,
        JSON.stringify({ quantity: 1, rotation: "BY_TIME", rotationInterval: 10 }),
        { headers, tags: { op: "generate" } },
    );
    genTrend.add(res.timings.duration);
    const ok = check(res, { "generate 2xx": (r) => r.status >= 200 && r.status < 300 });
    genErr.add(!ok);
    sleep(1);
}
