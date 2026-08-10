/**
 * Однократная миграция трафика с Luna Proxy (прокси1) на Mango Proxy (прокси2).
 * Запуск: из папки backend: npx ts-node -r tsconfig-paths/register scripts/luna-to-mango-migrate.ts
 * Или: npm run script:luna-to-mango
 *
 * Перед запуском: .env с DATABASE_URL, MANGO_PROXY_BASE_URL, MANGO_PROXY_API_KEY.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function generateRandomString(length: number = 24): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const chars = letters + "0123456789";
    let result = letters[randomBytes(1)[0] % letters.length];
    const bytes = randomBytes(length - 1);
    for (let i = 0; i < length - 1; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result[0].toLowerCase() + result.slice(1);
}

async function main() {
    console.log("[Luna→Mango] === Начало миграции ===");
    console.log("[Luna→Mango] Время запуска:", new Date().toISOString());

    const baseURL = process.env.MANGO_PROXY_BASE_URL;
    const appKey = process.env.MANGO_PROXY_API_KEY;
    
    console.log("[Luna→Mango] Проверка конфигурации:");
    console.log("  - MANGO_PROXY_BASE_URL:", baseURL ? `${baseURL.substring(0, 30)}...` : "НЕ ЗАДАН");
    console.log("  - MANGO_PROXY_API_KEY:", appKey ? `${appKey.substring(0, 8)}...` : "НЕ ЗАДАН");
    
    if (!baseURL || !appKey) {
        throw new Error("Set MANGO_PROXY_BASE_URL and MANGO_PROXY_API_KEY in .env");
    }

    const mangoApi = axios.create({ 
        baseURL,
        timeout: 30000,
        validateStatus: () => true,
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
    
    let skippedZeroTraffic = 0;
    let failedCreateAccount = 0;
    let failedAddFlow = 0;
    const successUserIds: string[] = [];

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
                    failedCreateAccount++;
                    continue;
                }
                
                premiumUsername = `${username}:${account}:${password}`;
                await prisma.user.update({
                    where: { id: user.id },
                    data: { premiumUsername },
                });
                console.log(`  [${user.id}] Создан аккаунт Mango, сохранён premiumUsername`);
            } catch (e: unknown) {
                const err = e as Error & { code?: string; response?: { status: number; data: unknown } };
                console.error(`  [${user.id}] ИСКЛЮЧЕНИЕ при создании аккаунта Mango:`);
                console.error(`  [${user.id}] Тип ошибки: ${err.name}`);
                console.error(`  [${user.id}] Сообщение: ${err.message}`);
                console.error(`  [${user.id}] Код ошибки: ${err.code || "N/A"}`);
                if (err.response) {
                    console.error(`  [${user.id}] Response status: ${err.response.status}`);
                    console.error(`  [${user.id}] Response data: ${JSON.stringify(err.response.data)}`);
                }
                console.error(`  [${user.id}] Stack: ${err.stack}`);
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
            const data = res?.data as { code?: number; msg?: string; message?: string } | string;
            
            console.log(`  [${user.id}] /add_user_flow ответ: status=${status}`);
            console.log(`  [${user.id}] /add_user_flow data: ${JSON.stringify(data)}`);
            
            if (status >= 200 && status < 300) {
                if (typeof data === "string" && (data.trimStart().startsWith("<") || data.includes("<!DOCTYPE"))) {
                    console.error(`  [${user.id}] ОШИБКА: add_user_flow вернул HTML вместо JSON`);
                    console.error(`  [${user.id}] HTML начало: ${data.substring(0, 200)}`);
                    failedAddFlow++;
                } else if (typeof data === "object" && data && data.code === "1") {
                    // Mango API возвращает code:"1" при успехе
                    addFlowOk = true;
                    console.log(`  [${user.id}] add_user_flow УСПЕХ: ${data.msg || "OK"}`);
                } else if (typeof data === "object" && data && (data.code === 0 || data.code === "0" || data.code === 200)) {
                    // Альтернативные варианты успеха
                    addFlowOk = true;
                    console.log(`  [${user.id}] add_user_flow УСПЕХ: ${data.msg || "OK"}`);
                } else {
                    console.error(`  [${user.id}] ОШИБКА: API вернул код ошибки: code=${(data as any)?.code}, msg=${(data as any)?.msg || (data as any)?.message || "N/A"}`);
                    failedAddFlow++;
                }
            } else {
                console.error(`  [${user.id}] ОШИБКА: add_user_flow HTTP статус ${status}`);
                failedAddFlow++;
            }
        } catch (e: unknown) {
            const err = e as Error & { code?: string; response?: { status: number; data: unknown } };
            console.error(`  [${user.id}] ИСКЛЮЧЕНИЕ при add_user_flow:`);
            console.error(`  [${user.id}] Тип ошибки: ${err.name}`);
            console.error(`  [${user.id}] Сообщение: ${err.message}`);
            console.error(`  [${user.id}] Код ошибки: ${err.code || "N/A"}`);
            if (err.response) {
                console.error(`  [${user.id}] Response status: ${err.response.status}`);
                console.error(`  [${user.id}] Response data: ${JSON.stringify(err.response.data)}`);
            }
            console.error(`  [${user.id}] Stack: ${err.stack}`);
            failedAddFlow++;
        }
        
        if (!addFlowOk) {
            console.log(`  [${user.id}] Перенос НЕ ВЫПОЛНЕН — пропуск обновления БД`);
            continue;
        }

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
            console.log(`  [${user.id}] Создан UserPackage RESIDENT_PREMIUM`);
        }

        successUserIds.push(user.id);
        console.log(`  [${user.id}] УСПЕХ: Перенесено ${trafficMB} МБ на Mango, premiumTrafficLeft обновлён`);
    }
    
    console.log("\n[Luna→Mango] === ИТОГИ МИГРАЦИИ ===");
    console.log(`  Всего пользователей для обработки: ${users.length}`);
    console.log(`  Пропущено (трафик 0): ${skippedZeroTraffic}`);
    console.log(`  Ошибок создания аккаунта: ${failedCreateAccount}`);
    console.log(`  Ошибок добавления трафика: ${failedAddFlow}`);
    console.log(`  Успешно обработано: ${successUserIds.length}`);

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

    console.log("\n[Luna→Mango] --- Очистка данных Luna из БД (только успешные) ---");

    const updatedUsers = await prisma.user.updateMany({
        where: { id: { in: successUserIds } },
        data: {
            residentData: "",
            residentTrafficLeft: "0",
            residentTotalUsed: "0",
        },
    });
    console.log(`  - Обнулено resident-полей: ${updatedUsers.count}`);

    const deletedUserPackages = await prisma.userPackage.deleteMany({
        where: { type: "RESIDENT", userId: { in: successUserIds } },
    });
    console.log(`  - Удалено UserPackage RESIDENT: ${deletedUserPackages.count}`);

    const deletedProxies = await prisma.proxy.deleteMany({
        where: { type: "RESIDENT", userId: { in: successUserIds } },
    });
    console.log(`  - Удалено Proxy RESIDENT: ${deletedProxies.count}`);

    const deletedPackages = await prisma.package.deleteMany({
        where: { type: "RESIDENT" },
    });
    console.log(`  - Удалено Package RESIDENT: ${deletedPackages.count}`);

    console.log("\n[Luna→Mango] === Миграция успешно завершена ===");
    console.log("[Luna→Mango] Время завершения:", new Date().toISOString());
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
