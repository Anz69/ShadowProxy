#!/usr/bin/env node
/**
 * Возврат legacy residentTrafficLeft (Luna) на денежный баланс юзера.
 * Запускается ОДИН раз вручную после деплоя миграций задачи 6 ТЗ.
 * Идемпотентен: при повторном запуске остаток уже 0 — выходит без изменений.
 *
 * Цена за Гб берётся из settings.proxy_tariffications.resident_premium ($/Гб).
 * Логика: gb = bytes / 1024^3; refund = gb * price; balance += refund; residentTrafficLeft = 0.
 * Каждое действие логируется в logs (type=SYSTEM) с деталями.
 */

const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "..", ".env");
require("dotenv").config({ path: envPath, override: true });

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
if (!url || url.indexOf("${") !== -1) {
    const host = (process.env.POSTGRES_HOST || "localhost").replace(/"/g, "");
    const port = (process.env.POSTGRES_PORT || "5432").replace(/"/g, "");
    const username = (process.env.POSTGRES_USERNAME || "postgres").replace(/"/g, "");
    const password = (process.env.POSTGRES_PASSWORD || "").replace(/"/g, "");
    const database = (process.env.POSTGRES_DATABASE || "shadow_proxy").replace(/"/g, "");
    url = `postgresql://${username}:${password}@${host}:${port}/${database}`;
}
if (!url) {
    console.error("[Resident→Balance] POSTGRES_URI not found");
    process.exit(1);
}

const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
    console.log("[Resident→Balance] === Возврат legacy RESIDENT-трафика на баланс ===");
    console.log("[Resident→Balance] Старт:", new Date().toISOString());

    // 1. Цена за Гб из настроек
    const setting = await prisma.setting.findUnique({
        where: { key: "proxy_tariffications" },
    });
    if (!setting) {
        console.error("[Resident→Balance] Нет settings.proxy_tariffications — прерывание");
        process.exit(2);
    }
    const pricePerGb = Number(setting.value?.resident_premium);
    if (!pricePerGb || isNaN(pricePerGb)) {
        console.error(
            "[Resident→Balance] settings.proxy_tariffications.resident_premium невалидна:",
            setting.value,
        );
        process.exit(2);
    }
    console.log(`[Resident→Balance] Цена возврата: ${pricePerGb} $/Гб`);

    // 2. Юзеры с положительным residentTrafficLeft
    const users = await prisma.user.findMany({
        where: { residentTrafficLeft: { not: "0" } },
        select: { id: true, email: true, residentTrafficLeft: true, balance: true },
    });
    console.log(`[Resident→Balance] Найдено юзеров для возврата: ${users.length}`);
    if (users.length === 0) {
        console.log("[Resident→Balance] Нет данных для миграции");
        await prisma.$disconnect();
        return;
    }

    let totalGb = 0;
    let totalRefund = 0;
    for (const u of users) {
        const bytes = BigInt(u.residentTrafficLeft || "0");
        if (bytes <= 0n) continue;

        // gb с точностью до 6 знаков
        const gb = Number(bytes) / 1024 ** 3;
        const refund = Math.round(gb * pricePerGb * 100) / 100;

        try {
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: u.id },
                    data: {
                        balance: { increment: new Prisma.Decimal(refund) },
                        residentTrafficLeft: "0",
                    },
                }),
                prisma.log.create({
                    data: {
                        type: "SYSTEM",
                        userId: u.id,
                        message: `Возврат legacy RESIDENT: ${gb.toFixed(3)} Гб × ${pricePerGb}$ = ${refund.toFixed(2)}$ → баланс`,
                        metadata: {
                            migratedBytes: String(bytes),
                            gb: gb.toFixed(6),
                            pricePerGb,
                            refundUsd: refund,
                        },
                    },
                }),
            ]);
            totalGb += gb;
            totalRefund += refund;
            console.log(`  ✓ ${u.email}: ${gb.toFixed(3)} Гб → +${refund.toFixed(2)}$`);
        } catch (e) {
            console.error(`  ✗ ${u.email}:`, e.message);
        }
    }

    console.log("[Resident→Balance] === Итог ===");
    console.log(`  Всего возвращено: ${totalGb.toFixed(3)} Гб`);
    console.log(`  Сумма возврата: ${totalRefund.toFixed(2)} $`);
    console.log("[Resident→Balance] Готово:", new Date().toISOString());

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error("[Resident→Balance] FATAL:", e);
    process.exit(1);
});
