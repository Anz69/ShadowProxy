// Run once with /etc/default mounted at /agent-default, after stopping the
// gateway gracefully. Never print either the old or the replacement token.
const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

async function main() {
    const db = new PrismaClient();
    const envPath = "/agent-default/proxy-agent-v2";
    const host = process.argv[2];
    if (!host || !/^[\d.]+$/.test(host)) throw new Error("Explicit node IPv4 required");
    const original = fs.readFileSync(envPath, "utf8");
    if (!/^AUTH_TOKEN=/m.test(original)) throw new Error("Agent token variable missing");
    const node = await db.proxyServer.findFirst({ where: { host, status: "ACTIVE" } });
    if (!node?.token) throw new Error("Active node not found");
    const token = randomBytes(32).toString("hex");
    try {
        fs.writeFileSync(envPath, original.replace(/^AUTH_TOKEN=.*$/m, `AUTH_TOKEN=${token}`), { mode: 0o600 });
        await db.proxyServer.update({ where: { id: node.id }, data: { token } });
        console.log("Node token rotated in agent configuration and database");
    } catch (error) {
        fs.writeFileSync(envPath, original, { mode: 0o600 });
        throw error;
    } finally {
        await db.$disconnect();
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
