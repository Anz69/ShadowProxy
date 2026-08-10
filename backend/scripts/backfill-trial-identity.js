#!/usr/bin/env node
/**
 * Бэкфилл TrialIdentity для антифрода триала (Часть 2 ТЗ).
 * Для всех User.trial != null с привязанным GOOGLE/TELEGRAM Account создаёт
 * запись в trial_identity (provider, providerKey=providerAccountId).
 * Идемпотентен: уникальный индекс (provider, provider_key) → дубли пропускаются.
 *
 * Запуск: docker exec shadowproxy-backend-1 node scripts/backfill-trial-identity.js
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
    console.error("[Backfill] POSTGRES_URI not found");
    process.exit(1);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
    console.log("[Backfill TrialIdentity] start", new Date().toISOString());

    const users = await prisma.user.findMany({
        where: { trial: { not: null } },
        select: {
            id: true,
            email: true,
            accounts: {
                where: { provider: { in: ["GOOGLE", "TELEGRAM"] } },
                select: { provider: true, providerAccountId: true },
            },
        },
    });
    console.log(`[Backfill] users with trial: ${users.length}`);

    let created = 0;
    let skippedNoAccount = 0;
    for (const u of users) {
        if (!u.accounts.length) {
            skippedNoAccount++;
            continue;
        }
        for (const a of u.accounts) {
            if (!a.providerAccountId) continue;
            try {
                await prisma.trialIdentity.create({
                    data: {
                        provider: a.provider,
                        providerKey: a.providerAccountId,
                        usedByUserId: u.id,
                    },
                });
                created++;
            } catch (e) {
                // P2002 = unique violation → уже есть, ок
                if (e && e.code === "P2002") continue;
                console.error(`  ! ${u.email} (${a.provider}): ${e.message}`);
            }
        }
    }

    console.log(`[Backfill] created=${created} skipped_no_account=${skippedNoAccount}`);
    console.log("[Backfill TrialIdentity] done", new Date().toISOString());
    await prisma.$disconnect();
}

main().catch((e) => {
    console.error("[Backfill] FATAL:", e);
    process.exit(1);
});
