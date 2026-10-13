const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { hash } = require("argon2");
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { createClient } = require("redis");
const { RedisStore } = require("connect-redis");
const signature = require("cookie-signature");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let phase = "setup";
const selectedTariffs = new Set((process.env.QA_TARIFFS || "ISP_USA,RESIDENTIAL_LITE").split(","));

async function main() {
    const db = new PrismaClient();
    const password = randomBytes(24).toString("base64url");
    const prefix = `qa-live-${randomUUID()}`;
    let user;
    let redis;
    let sessionId;
    const gateways = [];
    const trialUserIds = [];
    const client = axios.create({ baseURL: process.env.HOST + "/api", timeout: 30000 });
    try {
        user = await db.user.create({ data: {
            email: prefix + "@example.invalid", password: await hash(password), authMethod: "CREDENTIALS",
            emailVerified: true, region: "EUROPE", balance: 20,
        } });
        // Disposable QA session; production captcha remains enabled and is not
        // bypassed in application code. This is not a login/captcha test.
        redis = createClient({ url: process.env.REDIS_URI });
        await redis.connect();
        const store = new RedisStore({ client: redis, prefix: "sessions:" });
        sessionId = randomBytes(32).toString("hex");
        await store.set(sessionId, { userId: user.id, cookie: { maxAge: 300000, httpOnly: true, secure: true, sameSite: "none" } });
        client.defaults.headers.Cookie = `session=${encodeURIComponent("s:" + signature.sign(sessionId, process.env.SESSION_SECRET))}`;
        const profile = await client.get("/users/me");
        assert.equal("password" in profile.data, false);
        assert.equal("proxyEmpireSubUserToken" in profile.data, false);
        console.log("PASS public profile: authenticated QA session, no provider token or password (captcha login not covered)");
        const unauthorized = await client.get("/admin/stats", { validateStatus: () => true });
        assert.equal(unauthorized.status, 403);
        console.log("PASS public authorization: ordinary user cannot access admin");

        for (const [tariff, field, country] of [
            ["ISP_USA", "ispUsaTrafficLeft", "US"],
            ["RESIDENTIAL_LITE", "residentialLiteTrafficLeft", process.env.QA_LITE_GEO || "DE"],
        ]) {
            if (!selectedTariffs.has(tariff)) continue;
            phase = `${tariff}: purchase`;
            const paid = await client.post("/payments/invoice/resident", { tariff, traffic: 0.1, asset: "USDT", merchant: "BALANCE" });
            assert.equal(paid.data.status, "PAID");
            assert.ok(paid.data.userPackageId);
            phase = `${tariff}: generation`;
            const response = await client.post(`/package/${paid.data.userPackageId}/generate-proxy`, {
                location: country, rotation: "BY_REQUEST", quantity: 1,
            });
            const raw = response.data;
            const item = (Array.isArray(raw) ? raw : raw.proxies || raw.data || [raw])[0];
            const proxy = item?.proxyPort ? {
                userLogin: item.proxyPort.login, userPassword: item.proxyPort.password,
                serverHost: item.proxyPort.serverHost, userPort: item.proxyPort.port,
            } : item;
            assert.ok(proxy?.userLogin && proxy?.userPassword && proxy?.serverHost);
            const server = await db.proxyServer.findFirstOrThrow({ where: { host: proxy.serverHost } });
            gateways.push({ host: server.host, token: server.token, login: proxy.userLogin });
            const agent = new HttpsProxyAgent(`http://${encodeURIComponent(proxy.userLogin)}:${encodeURIComponent(proxy.userPassword)}@${proxy.serverHost}:${proxy.userPort}`);
            const start = await db.user.findUniqueOrThrow({ where: { id: user.id } });
            const before = BigInt(start[field]);
            for (let n = 0; n < 5; n++) {
                phase = `${tariff}: paid download ${n + 1}`;
                const download = await axios.get("https://speed.cloudflare.com/__down?bytes=250000", {
                    httpsAgent: agent, proxy: false, responseType: "arraybuffer", timeout: 30000,
                });
                assert.ok(download.data.length >= 250000);
            }
            let consumed = 0n;
            for (let n = 0; n < 25; n++) {
                const actual = await db.user.findUniqueOrThrow({ where: { id: user.id } });
                consumed = before - BigInt(actual[field]);
                if (consumed >= 1250000n) break;
                await delay(1000);
            }
            assert.ok(consumed >= 1250000n, `${tariff}: missing traffic debit`);
            const profile = await client.get("/users/me");
            assert.equal(BigInt(profile.data[field]), before - consumed);
            const savedProxy = await db.proxy.findFirstOrThrow({ where: { userId: user.id, userLogin: proxy.userLogin } });
            assert.equal(BigInt(savedProxy.trafficUsed), consumed);
            const logs = await db.trafficLog.findMany({ where: { userPackageId: paid.data.userPackageId } });
            assert.equal(logs.reduce((sum, row) => sum + row.inBytes + row.outBytes, 0n), consumed);
            console.log(`PASS ${tariff}: purchase -> generation -> 5 working downloads -> ${consumed} billed bytes -> profile matches`);
            // Only the disposable QA user's balance is modified.
            await db.user.update({ where: { id: user.id }, data: { [field]: "10000" } });
            await axios.get("https://speed.cloudflare.com/__down?bytes=250000", {
                httpsAgent: agent, proxy: false, responseType: "arraybuffer", timeout: 30000,
            }).catch(() => undefined);
            let zero = false;
            for (let n = 0; n < 25; n++) {
                const actual = await db.user.findUniqueOrThrow({ where: { id: user.id } });
                if (actual[field] === "0") { zero = true; break; }
                await delay(1000);
            }
            assert.ok(zero, "Gateway must exhaust QA limit");
            await delay(1500);
            await assert.rejects(axios.get("https://api.ipify.org", { httpsAgent: agent, proxy: false, timeout: 10000 }));
            console.log(`PASS ${tariff}: limit reaches zero, subsequent connection blocked`);
        }

        // Validate local trial grant/identity anti-fraud without claiming to
        // exercise Google/Telegram OAuth itself.
        for (const [tariff, field, country] of [
            ["ISP_USA", "ispUsaTrafficLeft", "US"],
            ["RESIDENTIAL_LITE", "residentialLiteTrafficLeft", process.env.QA_LITE_GEO || "DE"],
        ]) {
            if (!selectedTariffs.has(tariff)) continue;
            phase = `${tariff}: trial grant`;
            const trialUser = await db.user.create({ data: {
                email: `${prefix}-${tariff}@example.invalid`, password: await hash(password),
                authMethod: "CREDENTIALS", emailVerified: true, region: "EUROPE",
            } });
            trialUserIds.push(trialUser.id);
            await db.account.create({ data: { userId: trialUser.id, type: "oauth", provider: "GOOGLE",
                providerAccountId: `${prefix}-${tariff}`, accessToken: "isolated-qa", expiresAt: 0 } });
            await store.set(sessionId, { userId: trialUser.id, cookie: { maxAge: 300000, httpOnly: true, secure: true, sameSite: "none" } });
            const grants = await Promise.all(Array.from({ length: 3 }, () => client.post("/users/trial", { tariffType: tariff }, { validateStatus: () => true })));
            assert.equal(grants.filter(grant => grant.status === 200).length, 1);
            const granted = grants.find(grant => grant.status === 200);
            assert.equal((await db.user.findUniqueOrThrow({ where: { id: trialUser.id } }))[field], String(100 * 1024 ** 2));
            phase = `${tariff}: trial timed generation`;
            const generated = await client.post(`/package/${granted.data.userPackageId}/generate-proxy`, {
                location: country, rotation: "BY_TIME", rotationInterval: 5, quantity: 1,
            });
            const raw = generated.data;
            const item = (Array.isArray(raw) ? raw : raw.proxies || raw.data || [raw])[0];
            const proxy = item?.proxyPort ? {
                userLogin: item.proxyPort.login, userPassword: item.proxyPort.password,
                serverHost: item.proxyPort.serverHost, userPort: item.proxyPort.port,
            } : item;
            const server = await db.proxyServer.findFirstOrThrow({ where: { host: proxy.serverHost } });
            gateways.push({ host: server.host, token: server.token, login: proxy.userLogin });
            const agent = new HttpsProxyAgent(`http://${encodeURIComponent(proxy.userLogin)}:${encodeURIComponent(proxy.userPassword)}@${proxy.serverHost}:${proxy.userPort}`);
            const savedProxy = await db.proxy.findFirstOrThrow({ where: { userId: trialUser.id, userLogin: proxy.userLogin } });
            assert.match(savedProxy.username, /-time-5-session-[A-Za-z0-9]{8}$/);
            const ips = [];
            for (let n = 0; n < 3; n++) {
                phase = `${tariff}: trial IP lookup ${n + 1}`;
                const ip = await axios.get("https://api.ipify.org", { httpsAgent: agent, proxy: false, timeout: 30000 });
                ips.push(String(ip.data));
                phase = `${tariff}: trial timed download ${n + 1}`;
                const download = await axios.get("https://speed.cloudflare.com/__down?bytes=100000", {
                    httpsAgent: agent, proxy: false, responseType: "arraybuffer", timeout: 30000,
                });
                assert.equal(download.data.length, 100000);
            }
            assert.equal(new Set(ips).size, 1, "Timed rotation must preserve the IP within the five-minute interval");
            let remaining;
            for (let n = 0; n < 25; n++) {
                remaining = BigInt((await db.user.findUniqueOrThrow({ where: { id: trialUser.id } }))[field]);
                if (remaining <= BigInt(100 * 1024 ** 2 - 300000)) break;
                await delay(1000);
            }
            assert.ok(remaining > 0n && remaining <= BigInt(100 * 1024 ** 2 - 300000));
            phase = `${tariff}: trial final connection`;
            await axios.get("https://api.ipify.org", { httpsAgent: agent, proxy: false, timeout: 30000 });
            console.log(`PASS ${tariff}: one of 3 concurrent trial grants -> timed rotation stable -> 3 downloads -> debit -> still works`);
        }
    } finally {
        for (const gateway of gateways) {
            await axios.post(`http://${gateway.host}:808/block-login`, { login: gateway.login }, {
                headers: { Authorization: `Bearer ${gateway.token}` }, timeout: 5000,
            }).catch(() => undefined);
        }
        if (user) {
            await db.proxy.deleteMany({ where: { userId: user.id } });
            await db.notification.deleteMany({ where: { userId: user.id } });
            await db.payment.deleteMany({ where: { userId: user.id } });
            await db.user.delete({ where: { id: user.id } });
        }
        for (const id of trialUserIds) {
            await db.proxy.deleteMany({ where: { userId: id } });
            await db.notification.deleteMany({ where: { userId: id } });
            await db.account.deleteMany({ where: { userId: id } });
            await db.trialIdentity.deleteMany({ where: { usedByUserId: id } });
            await db.user.delete({ where: { id } });
        }
        if (redis) {
            if (sessionId) await redis.del("sessions:" + sessionId);
            await redis.quit();
        }
        await db.$disconnect();
        console.log("QA cleanup: test user, proxies, packages and payments removed; logins blocked");
    }
}
main().catch(error => {
    // Axios config contains cookies and proxy passwords. Never dump the object.
    console.error("QA live failure:", phase, error.response?.status || error.code || error.message,
        error.code === "ERR_ASSERTION" ? error.message : "",
        error.response?.data?.message || "");
    process.exitCode = 1;
});
