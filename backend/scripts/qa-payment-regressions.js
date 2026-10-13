// Isolated, real-PostgreSQL regression suite. Never calls a payment provider
// or changes existing users. Runs explicitly; it is not part of application boot.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PaymentsService } = require("../dist/payments/payments.service");
const { UserService } = require("../dist/user/user.service");

async function main() {
    const db = new PrismaClient();
    const userIds = [];
    const prefix = `qa-security-${randomUUID()}`;
    let providerFails = false;
    const noOp = async () => undefined;
    const settings = { getDiscounts: async () => ({ trial: 30, review: 30 }) };
    const users = { findById: id => db.user.findUniqueOrThrow({ where: { id } }) };
    const service = new PaymentsService(
        { createInvoice: async () => {
            if (providerFails) throw new Error("isolated QA simulated provider failure");
            return { pay_url: "https://example.invalid/qa-payment" };
        } }, {}, { getOrThrow: () => 3600 }, db, settings, {}, {}, { log: noOp, error: noOp }, {},
        users, { awardReferralReward: noOp }, {}, {},
    );
    async function user(extra = {}) {
        const u = await db.user.create({ data: {
            email: `${prefix}-${userIds.length}@example.invalid`, password: "", authMethod: "CREDENTIALS",
            region: "EUROPE", balance: 10, referralBalance: 10, ...extra,
        } });
        userIds.push(u.id);
        return u;
    }
    function invoice(u, merchant = "BALANCE", amountUsd = 7) {
        return service.buildAndSaveInvoice({ merchant, amountUsd, asset: "USDT",
            contents: [{ type: "resident", tariff: "ISP_USA", traffic: 1 }] }, u.id);
    }
    function settle(id) {
        return db.$transaction(tx => service.processPaidOrder(tx, { order_id: id }), { timeout: 30000 });
    }
    try {
        const u = await user();
        const credit = await db.payment.create({ data: {
            userId: u.id, provider: "HELEKET", amount: 5, amountUsd: 5, asset: "USDT",
            metadata: { contents: [{ type: "balance", amount: 5 }] },
        } });
        await Promise.all(Array.from({ length: 12 }, () => settle(credit.id)));
        assert.equal(Number((await users.findById(u.id)).balance), 15);
        console.log("PASS SP-01: 12 concurrent balance callbacks -> one credit");

        const traffic = await db.payment.create({ data: {
            userId: u.id, provider: "HELEKET", amount: 7, amountUsd: 7, asset: "USDT",
            metadata: { contents: [{ type: "resident", tariff: "ISP_USA", traffic: 1 }] },
        } });
        await Promise.all(Array.from({ length: 12 }, () => settle(traffic.id)));
        assert.equal((await users.findById(u.id)).ispUsaTrafficLeft, String(1024 ** 3));
        assert.equal((await db.payment.findUniqueOrThrow({ where: { id: traffic.id } })).metadata.provisioningPending, "ISP_USA");
        console.log("PASS SP-01: 12 concurrent traffic callbacks -> one GB + durable job");

        for (const merchant of ["BALANCE", "REFERRAL_BALANCE"]) {
            const buyer = await user();
            const results = await Promise.allSettled(Array.from({ length: 8 }, () => invoice(buyer, merchant)));
            assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
            const actual = await users.findById(buyer.id);
            assert.equal(Number(actual[merchant === "BALANCE" ? "balance" : "referralBalance"]), 3);
            assert.equal(actual.ispUsaTrafficLeft, String(1024 ** 3));
            console.log(`PASS SP-04: 8 concurrent ${merchant} purchases -> one purchase, nonnegative balance`);
        }
        const discountUser = await user({ trialDiscountAvailable: true });
        const invoices = await Promise.all(Array.from({ length: 8 }, () => invoice(discountUser, "CRYPTO_BOT", 10)));
        assert.equal(invoices.filter(p => p.metadata.discount).length, 1);
        assert.equal(invoices.filter(p => Number(p.amountUsd) === 7).length, 1);
        console.log("PASS SP-05: 8 concurrent invoices -> one reserved discount");
        const discounted = invoices.find(p => p.metadata.discount);
        await service.cancelPendingInvoice(discounted.id);
        assert.equal((await users.findById(discountUser.id)).trialDiscountAvailable, true);
        await settle(discounted.id);
        assert.equal((await users.findById(discountUser.id)).ispUsaTrafficLeft, "0");
        console.log("PASS SP-05: cancellation restores discount; cancelled callback cannot credit");

        providerFails = true;
        await assert.rejects(invoice(discountUser, "CRYPTO_BOT", 10));
        assert.equal((await users.findById(discountUser.id)).trialDiscountAvailable, true);
        providerFails = false;
        console.log("PASS SP-05: provider failure releases reserved discount");

        const trial = await user({ trialDiscountAvailable: true });
        await db.payment.create({ data: {
            userId: trial.id, provider: "HELEKET", status: "PAID", amount: 1, amountUsd: 1, asset: "USDT",
            metadata: { contents: [{ type: "balance", amount: 1 }] },
        } });
        assert.deepEqual(await service.getActiveDiscountForUser(trial.id), { kind: "trial", pct: 30 });
        console.log("PASS SP-07: balance topup does not consume first-purchase eligibility");

        const rollback = await user();
        const original = service.processPaidOrder;
        service.processPaidOrder = async () => { throw new Error("isolated QA transaction rollback"); };
        await assert.rejects(invoice(rollback));
        service.processPaidOrder = original;
        assert.equal(Number((await users.findById(rollback.id)).balance), 10);
        assert.equal(await db.payment.count({ where: { userId: rollback.id } }), 0);
        console.log("PASS SP-04: failed settlement rolls back debit and payment creation");

        const profileService = new UserService(db, {}, {}, {}, {}, {}, {});
        await db.account.create({ data: { userId: trial.id, type: "oauth", provider: "GOOGLE",
            providerAccountId: prefix, accessToken: "qa-access", refreshToken: "qa-refresh", expiresAt: 0 } });
        const profile = await profileService.findById(trial.id, true, true);
        assert.equal("accessToken" in profile.accounts[0], false);
        assert.equal("refreshToken" in profile.accounts[0], false);
        assert.equal("proxyEmpireSubUserToken" in profile, false);
        const a = await profileService.generateApiKey(trial.id);
        const b = await profileService.generateApiKey(trial.id);
        assert.match(a, /^[a-f0-9]{64}$/);
        assert.notEqual(a, b);
        console.log("PASS SP-08/09: profile excludes tokens; random API keys differ");
    } finally {
        await db.notification.deleteMany({ where: { userId: { in: userIds } } });
        await db.account.deleteMany({ where: { userId: { in: userIds } } });
        await db.payment.deleteMany({ where: { userId: { in: userIds } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        await db.$disconnect();
        console.log("QA cleanup: isolated users, accounts and payments removed");
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
