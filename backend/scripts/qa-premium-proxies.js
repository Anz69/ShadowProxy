// Explicit disposable dev QA. Uses a dedicated provider sub-user, never an
// existing customer's proxy or the master account's proxy credentials.
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("redis");
const { RedisStore } = require("connect-redis");
const signature = require("cookie-signature");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { ProxyEmpireProvider } = require("../dist/proxy/providers/services/proxy-empire.provider");
const { ProxyService } = require("../dist/proxy/proxy.service");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let phase = "setup";

async function main() {
    assert.equal(process.env.NODE_ENV, "development", "Dev-only QA");
    const db = new PrismaClient();
    const redis = createClient({ url: process.env.REDIS_URI });
    const email = `qa-premium-${randomUUID()}@example.invalid`;
    let syncErrors = 0;
    const logger = { log: async () => {}, error: async () => { syncErrors++; }, recordTrafficLogForUserTariff: async () => {} };
    const config = { get: (key, fallback) => process.env[key] ?? fallback };
    const provider = new ProxyEmpireProvider(config, logger);
    const sessionId = randomBytes(32).toString("hex");
    let user;
    try {
        user = await db.user.create({ data: {
            email, password: "", authMethod: "CREDENTIALS", emailVerified: true,
            region: "EUROPE", balance: 10,
        } });
        await redis.connect();
        await new RedisStore({ client: redis, prefix: "sessions:" }).set(sessionId, {
            userId: user.id, cookie: { maxAge: 600000, httpOnly: true, secure: true, sameSite: "none" },
        });
        const client = axios.create({
            baseURL: process.env.HOST + "/api", timeout: 90000,
            headers: { Cookie: `session=${encodeURIComponent("s:" + signature.sign(sessionId, process.env.SESSION_SECRET))}` },
        });
        // Limit the reconciliation service to this disposable user only.
        const scopedDb = {
            user: {
                findMany: args => db.user.findMany({ ...args, where: { ...args.where, id: user.id } }),
                updateMany: args => db.user.updateMany({ ...args, where: { ...args.where, id: user.id } }),
            },
            payment: { findFirst: args => db.payment.findFirst({ ...args, where: { ...args.where, userId: user.id } }) },
        };
        const sync = new ProxyService({}, {}, {}, {}, {}, provider, {}, {}, scopedDb, config, logger);
        for (const [tariff, field] of [
            ["PREMIUM_RESIDENTIAL", "premiumResidentialTrafficLeft"],
            ["MOBILE", "mobileTrafficLeft"],
        ]) {
            if (process.env.QA_PREMIUM_TARIFF && process.env.QA_PREMIUM_TARIFF !== tariff) continue;
            phase = `${tariff}: purchase`;
            const paid = await client.post("/payments/invoice/resident", { tariff, traffic: 0.1, asset: "USDT", merchant: "BALANCE" });
            assert.equal(paid.data.status, "PAID");
            assert.ok(paid.data.userPackageId);
            phase = `${tariff}: provisioning`;
            let pending;
            for (let n = 0; n < 40; n++) {
                pending = (await db.payment.findUniqueOrThrow({ where: { id: paid.data.id } })).metadata.provisioningPending;
                if (!pending) break;
                await delay(3000);
            }
            assert.ok(!pending, `${tariff}: provider provisioning still pending`);
            const before = BigInt((await db.user.findUniqueOrThrow({ where: { id: user.id } }))[field]);
            assert.equal(before, BigInt(Math.round(0.1 * 1024 ** 3)));
            phase = `${tariff}: generation`;
            const generated = await client.post(`/package/${paid.data.userPackageId}/generate-proxy`, {
                location: process.env.QA_PREMIUM_GEO || "US", rotation: "BY_REQUEST", quantity: 1,
            });
            const raw = generated.data;
            const item = (Array.isArray(raw) ? raw : raw.proxies || raw.data || [raw])[0];
            const proxy = item?.proxyPort ? {
                userLogin: item.proxyPort.login, userPassword: item.proxyPort.password,
                serverHost: item.proxyPort.serverHost, userPort: item.proxyPort.port,
            } : item;
            assert.ok(proxy?.userLogin && proxy?.userPassword);
            const agent = new HttpsProxyAgent(
                `http://${encodeURIComponent(proxy.userLogin)}:${encodeURIComponent(proxy.userPassword)}@${proxy.serverHost || proxy.host}:${proxy.userPort || proxy.port}`,
            );
            for (let n = 0; n < 3; n++) {
                phase = `${tariff}: download ${n + 1}`;
                const result = await axios.get("https://speed.cloudflare.com/__down?bytes=100000", {
                    httpsAgent: agent, proxy: false, timeout: 30000, responseType: "arraybuffer",
                });
                assert.equal(result.data.length, 100000);
            }
            phase = `${tariff}: usage reconciliation`;
            let remaining = before;
            for (let n = 0; n < 100; n++) {
                await sync.syncProxyEmpireUsage();
                remaining = BigInt((await db.user.findUniqueOrThrow({ where: { id: user.id } }))[field]);
                if (remaining < before) break;
                if (n % 20 === 0) {
                    const counters = await provider.getSubUserInfo(email);
                    console.log("QA usage waiting:", tariff, JSON.stringify(counters?.[tariff === "MOBILE" ? "mobile" : "residential"]), "errors:", syncErrors);
                }
                await delay(3000);
            }
            assert.ok(remaining >= 0n && remaining < before, `${tariff}: no provider usage reflected locally`);
            const profile = await client.get("/users/me");
            assert.equal(BigInt(profile.data[field]), remaining);
            console.log(`PASS ${tariff}: paid purchase -> provider provisioning -> generation -> 3 downloads -> profile debit`);
        }
    } finally {
      try {
        if (user) {
            const actual = await db.user.findUnique({ where: { id: user.id }, select: { proxyEmpireSubUserEmail: true } });
            try {
                if (actual?.proxyEmpireSubUserEmail) {
                    assert.equal(actual.proxyEmpireSubUserEmail, email, "Cleanup must target only the dedicated QA provider user");
                    const removed = await axios.delete(
                        `https://panel.proxyempire.io/api/v2/subusers/${encodeURIComponent(email)}`,
                        { headers: { Authorization: `Bearer ${process.env.PROXYEMPIRE_API_KEY}` },
                            timeout: 10000, validateStatus: status => status === 200 || status === 404 },
                    );
                    assert.ok(removed.status === 200 || removed.status === 404);
                }
            } catch {
                console.log("QA provider cleanup not confirmed; dedicated qa-premium sub-user needs cleanup");
                process.exitCode = 1;
            }
            await db.proxy.deleteMany({ where: { userId: user.id } });
            await db.notification.deleteMany({ where: { userId: user.id } });
            await db.payment.deleteMany({ where: { userId: user.id } });
            await db.user.delete({ where: { id: user.id } });
        }
      } finally {
        if (redis.isOpen) {
            await redis.del("sessions:" + sessionId);
            await redis.quit();
        }
        await db.$disconnect();
        console.log("QA cleanup: dedicated premium user/session/payments/proxies removed");
      }
    }
}

main().catch(error => {
    console.error("QA premium failure:", phase, error.response?.status || error.code || error.name,
        error.code === "ERR_ASSERTION" || error instanceof TypeError ? error.message : "");
    process.exitCode = 1;
});
