#!/usr/bin/env node
/**
 * Миграция трафика Luna → Mango (запускается из migrate-deploy после prisma migrate deploy).
 * Идемпотентна: при повторном запуске не найдёт данных для переноса и ничего не сломает.
 */

const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "..", ".env");
require("dotenv").config({ path: envPath, override: true });

// В проекте Prisma использует POSTGRES_URI (см. prisma/schema), не DATABASE_URL
let url = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (url && typeof url === "string") url = url.trim();
if (!url && fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:DATABASE_URL|POSTGRES_URI)\s*=\s*(.*)$/);
    if (m) {
      url = m[1].replace(/#.*$/, "").trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
}
// Если в .env шаблон вида postgresql://${POSTGRES_USERNAME}:... — собираем URL из POSTGRES_*
if (!url || url.indexOf("${") !== -1) {
  const host = (process.env.POSTGRES_HOST || "localhost").replace(/"/g, "");
  const port = (process.env.POSTGRES_PORT || "5432").replace(/"/g, "");
  const username = (process.env.POSTGRES_USERNAME || "postgres").replace(/"/g, "");
  const password = (process.env.POSTGRES_PASSWORD || "").replace(/"/g, "");
  const database = (process.env.POSTGRES_DATABASE || "shadow_proxy").replace(/"/g, "");
  url = `postgresql://${username}:${password}@${host}:${port}/${database}`;
}

if (url) {
  url = url.replace(/\r\n/g, "").replace(/\n/g, "");
  url = url.replace(/@([^@]+):\/(?!\/)/, "@$1:5432/");
}

if (!url || !url.trim()) {
  console.error("[Luna→Mango] Не задан POSTGRES_URI / DATABASE_URL и нет POSTGRES_* в", envPath);
  throw new Error("POSTGRES_URI or POSTGRES_* not found in backend/.env");
}

const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const crypto = require("crypto");

const prisma = new PrismaClient({ datasources: { db: { url } } });

function generateRandomString(length = 24) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const chars = letters + "0123456789";
    let result = letters[crypto.randomBytes(1)[0] % letters.length];
    const bytes = crypto.randomBytes(length - 1);
    for (let i = 0; i < length - 1; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result[0].toLowerCase() + result.slice(1);
}

async function runLunaToMangoMigration() {
    try {
    console.log("[Luna→Mango] === Начало миграции ===");
    console.log("[Luna→Mango] Время запуска:", new Date().toISOString());
    
    const baseURL = process.env.MANGO_PROXY_BASE_URL;
    const appKey = process.env.MANGO_PROXY_API_KEY;
    
    console.log("[Luna→Mango] Проверка конфигурации:");
    console.log("  - MANGO_PROXY_BASE_URL:", baseURL ? `${baseURL.substring(0, 30)}...` : "НЕ ЗАДАН");
    console.log("  - MANGO_PROXY_API_KEY:", appKey ? `${appKey.substring(0, 8)}...` : "НЕ ЗАДАН");
    
    if (!baseURL || !appKey) {
        console.log("⏭ Luna→Mango: пропуск (MANGO_PROXY_BASE_URL или MANGO_PROXY_API_KEY не заданы)");
        return;
    }

    const mangoApi = axios.create({
        baseURL,
        timeout: 30000,
        validateStatus: () => true,
        transformResponse: [(data) => {
            if (data === "" || data == null) return {};
            if (typeof data !== "string") return data;
            if (data.trimStart().startsWith("<")) return data;
            try { return JSON.parse(data); } catch (_) { return data; }
        }],
    });
    mangoApi.interceptors.request.use((config) => {
        config.data = { ...config.data, app_key: appKey };
        return config;
    });

    console.log("[Luna→Mango] Запрос пользователей из БД...");
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { residentTrafficLeft: { not: "0" } },
                { residentData: { not: "" } },
            ],
        },
    });

    console.log(`[Luna→Mango] Найдено пользователей с трафиком Luna: ${users.length}`);
    
    if (users.length === 0) {
        console.log("[Luna→Mango] Нет пользователей для миграции. Возможные причины:");
        console.log("  - Все пользователи уже перенесены");
        console.log("  - residentTrafficLeft = '0' у всех");
        console.log("  - residentData пустая у всех");
        console.log("[Luna→Mango] Миграция завершена (нет данных для переноса).");
        return;
    }
    
    console.log("[Luna→Mango] Список пользователей для обработки:");
    for (const u of users) {
        console.log(`  - User ID: ${u.id}, residentTrafficLeft: ${u.residentTrafficLeft}, residentData: ${u.residentData ? "есть" : "пусто"}, premiumUsername: ${u.premiumUsername ? "есть" : "нет"}`);
    }

    /** Только у этих пользователей Mango API вернул успех — очищаем resident только по ним. */
    const successUserIds = [];

    let processedCount = 0;
    let skippedZeroTraffic = 0;
    let failedCreateAccount = 0;
    let failedAddFlow = 0;

    for (const user of users) {
        console.log(`\n[Luna→Mango] === Обработка пользователя ${user.id} ===`);
        
        const trafficBytes = BigInt(user.residentTrafficLeft || "0");
        const ONE_MB = 1024n * 1024n; // 1048576 байт
        
        if (trafficBytes <= 0n) {
            console.log(`  [${user.id}] Трафик: 0 байт — ПРОПУСК`);
            skippedZeroTraffic++;
            continue;
        }
        
        // Если трафик меньше 1 МБ — просто обнуляем без переноса в Mango
        if (trafficBytes < ONE_MB) {
            console.log(`  [${user.id}] Трафик: ${trafficBytes} байт (< 1 МБ) — обнуляем без переноса в Mango`);
            successUserIds.push(user.id);
            processedCount++;
            continue;
        }
        
        // Трафик >= 1 МБ — переносим в Mango
        const trafficMB = Math.ceil(Number(trafficBytes) / (1024 * 1024));
        
        console.log(`  [${user.id}] Трафик: ${trafficBytes} байт → ${trafficMB} МБ`)

        let premiumUsername = user.premiumUsername || "";
        console.log(`  [${user.id}] Текущий premiumUsername: ${premiumUsername || "(пусто)"}`);
        
        if (!premiumUsername || premiumUsername.length === 0) {
            const username = generateRandomString();
            console.log(`  [${user.id}] Создание нового аккаунта Mango, username: ${username}`);
            
            try {
                console.log(`  [${user.id}] Запрос POST /create_user...`);
                const createRes = await mangoApi.post("/create_user", { username });
                console.log(`  [${user.id}] /create_user ответ: status=${createRes.status}, data=${JSON.stringify(createRes.data)}`);
                
                if (createRes.status < 200 || createRes.status >= 300) {
                    console.error(`  [${user.id}] ОШИБКА /create_user: HTTP ${createRes.status}`);
                    console.error(`  [${user.id}] Response headers:`, JSON.stringify(createRes.headers));
                    failedCreateAccount++;
                    continue;
                }
                
                const account = generateRandomString(12);
                const password = generateRandomString(12);
                
                console.log(`  [${user.id}] Запрос POST /add_proxy_account...`);
                const addAccRes = await mangoApi.post("/add_proxy_account", { account, password, username });
                console.log(`  [${user.id}] /add_proxy_account ответ: status=${addAccRes.status}, data=${JSON.stringify(addAccRes.data)}`);
                
                if (addAccRes.status < 200 || addAccRes.status >= 300) {
                    console.error(`  [${user.id}] ОШИБКА /add_proxy_account: HTTP ${addAccRes.status}`);
                    console.error(`  [${user.id}] Response headers:`, JSON.stringify(addAccRes.headers));
                    failedCreateAccount++;
                    continue;
                }
                
                premiumUsername = `${username}:${account}:${password}`;
                await prisma.user.update({
                    where: { id: user.id },
                    data: { premiumUsername },
                });
                console.log(`  [${user.id}] Создан аккаунт Mango, сохранён premiumUsername`);
            } catch (e) {
                console.error(`  [${user.id}] ИСКЛЮЧЕНИЕ при создании аккаунта Mango:`);
                console.error(`  [${user.id}] Тип ошибки: ${e.name}`);
                console.error(`  [${user.id}] Сообщение: ${e.message}`);
                console.error(`  [${user.id}] Код ошибки: ${e.code || "N/A"}`);
                if (e.response) {
                    console.error(`  [${user.id}] Response status: ${e.response.status}`);
                    console.error(`  [${user.id}] Response data: ${JSON.stringify(e.response.data)}`);
                }
                if (e.request && !e.response) {
                    console.error(`  [${user.id}] Запрос отправлен, но ответ не получен (timeout/сеть)`);
                }
                console.error(`  [${user.id}] Stack: ${e.stack}`);
                failedCreateAccount++;
                continue;
            }
        }

        const [username] = premiumUsername.split(":");
        console.log(`  [${user.id}] Используем username для add_user_flow: ${username}`);
        
        let addFlowOk = false;
        try {
            console.log(`  [${user.id}] Запрос POST /add_user_flow с username=${username}, flow=${trafficMB}...`);
            const res = await mangoApi.post("/add_user_flow", { username, flow: trafficMB });
            const status = res?.status ?? 0;
            const data = res?.data;
            
            console.log(`  [${user.id}] /add_user_flow ответ: status=${status}`);
            console.log(`  [${user.id}] /add_user_flow data type: ${typeof data}`);
            console.log(`  [${user.id}] /add_user_flow data: ${typeof data === "string" ? data.substring(0, 500) : JSON.stringify(data)}`);
            
            if (status >= 200 && status < 300) {
                if (typeof data === "string" && (data.trimStart().startsWith("<") || data.includes("<!DOCTYPE"))) {
                    console.error(`  [${user.id}] ОШИБКА: add_user_flow вернул HTML вместо JSON (status ${status})`);
                    console.error(`  [${user.id}] HTML начало: ${data.substring(0, 200)}`);
                    failedAddFlow++;
                } else if (data && data.code === "1") {
                    // Mango API возвращает code:"1" при успехе
                    addFlowOk = true;
                    console.log(`  [${user.id}] add_user_flow УСПЕХ: ${data.msg || "OK"}`);
                } else if (data && (data.code === 0 || data.code === "0" || data.code === 200 || data.ret === 0)) {
                    // Альтернативные варианты успеха
                    addFlowOk = true;
                    console.log(`  [${user.id}] add_user_flow УСПЕХ: ${data.msg || "OK"}`);
                } else {
                    console.error(`  [${user.id}] ОШИБКА: API вернул код ошибки: code=${data?.code}, msg=${data?.msg || data?.message || "N/A"}`);
                    failedAddFlow++;
                }
            } else {
                console.error(`  [${user.id}] ОШИБКА: add_user_flow HTTP статус ${status}`);
                console.error(`  [${user.id}] Response headers:`, JSON.stringify(res.headers));
                failedAddFlow++;
            }
        } catch (e) {
            console.error(`  [${user.id}] ИСКЛЮЧЕНИЕ при add_user_flow:`);
            console.error(`  [${user.id}] Тип ошибки: ${e.name}`);
            console.error(`  [${user.id}] Сообщение: ${e.message}`);
            console.error(`  [${user.id}] Код ошибки: ${e.code || "N/A"}`);
            if (e.response) {
                console.error(`  [${user.id}] Response status: ${e.response.status}`);
                console.error(`  [${user.id}] Response data: ${JSON.stringify(e.response.data)}`);
            }
            if (e.request && !e.response) {
                console.error(`  [${user.id}] Запрос отправлен, но ответ не получен (timeout/сеть)`);
            }
            console.error(`  [${user.id}] Stack: ${e.stack}`);
            failedAddFlow++;
        }
        if (!addFlowOk) {
            console.log(`  [${user.id}] Перенос НЕ ВЫПОЛНЕН — пропуск обновления БД`);
            continue;
        }
        
        processedCount++;

        const newPremiumLeft = String(BigInt(user.premiumTrafficLeft || "0") + trafficBytes);
        await prisma.user.update({
            where: { id: user.id },
            data: { premiumTrafficLeft: newPremiumLeft },
        });

        const existing = await prisma.userPackage.findUnique({
            where: { userId_type: { userId: user.id, type: "RESIDENT_PREMIUM" } },
        });
        if (!existing) {
            await prisma.userPackage.create({
                data: { userId: user.id, type: "RESIDENT_PREMIUM" },
            });
        }
        successUserIds.push(user.id);
        console.log(`  [${user.id}] УСПЕХ: Перенесено ${trafficMB} МБ на Mango`);
    }

    console.log("\n[Luna→Mango] === ИТОГИ МИГРАЦИИ ===");
    console.log(`  Всего пользователей для обработки: ${users.length}`);
    console.log(`  Пропущено (трафик 0): ${skippedZeroTraffic}`);
    console.log(`  Ошибок создания аккаунта: ${failedCreateAccount}`);
    console.log(`  Ошибок добавления трафика: ${failedAddFlow}`);
    console.log(`  Успешно перенесено: ${successUserIds.length}`);

    if (successUserIds.length === 0) {
        console.log("\n[Luna→Mango] !!! ВНИМАНИЕ: Нет успешно перенесённых пользователей !!!");
        console.log("[Luna→Mango] Очистка resident НЕ выполняется.");
        console.log("[Luna→Mango] Проверьте логи выше для выяснения причин сбоев.");
        console.log("[Luna→Mango] Возможные причины:");
        console.log("  - Mango API недоступен или возвращает ошибки");
        console.log("  - Неверный MANGO_PROXY_API_KEY");
        console.log("  - Сетевые проблемы");
        console.log("  - Ошибки в данных пользователей");
        console.log("[Luna→Mango] Миграция завершена БЕЗ переноса данных.");
        return;
    }

    const updatedUsers = await prisma.user.updateMany({
        where: { id: { in: successUserIds } },
        data: {
            residentData: "",
            residentTrafficLeft: "0",
            residentTotalUsed: "0",
        },
    });
    const deletedUserPackages = await prisma.userPackage.deleteMany({
        where: { type: "RESIDENT", userId: { in: successUserIds } },
    });
    const deletedProxies = await prisma.proxy.deleteMany({
        where: { type: "RESIDENT", userId: { in: successUserIds } },
    });
    const deletedPackages = await prisma.package.deleteMany({ where: { type: "RESIDENT" } });

    console.log(`[Luna→Mango] Очистка только по успешным (${successUserIds.length}):`);
    console.log(`  - Обнулено resident-полей: ${updatedUsers.count}`);
    console.log(`  - Удалено UserPackage RESIDENT: ${deletedUserPackages.count}`);
    console.log(`  - Удалено Proxy RESIDENT: ${deletedProxies.count}`);
    console.log(`  - Удалено Package RESIDENT: ${deletedPackages.count}`);
    console.log("\n[Luna→Mango] === Миграция успешно завершена ===");
    console.log("[Luna→Mango] Время завершения:", new Date().toISOString());
} finally {
    await prisma.$disconnect();
}
}

async function main() {
    await runLunaToMangoMigration();
}

if (require.main === module) {
    main().catch((e) => {
        console.error("[Luna→Mango] Ошибка:", e.message);
        process.exit(1);
    });
} else {
    module.exports = { runLunaToMangoMigration };
}
