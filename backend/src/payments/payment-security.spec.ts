import { PaymentsService } from "./payments.service";
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";

describe("QA payment regressions SP-01/04/05/07", () => {
    let db: any;
    let service: PaymentsService;
    let user: any;
    let payments: any[];
    let lock: Promise<unknown>;

    beforeEach(() => {
        user = { id: "qa-user", balance: new Prisma.Decimal(10), referralBalance: new Prisma.Decimal(10),
            trialDiscountAvailable: false, reviewDiscountAvailable: false };
        payments = [];
        lock = Promise.resolve();
        db = {
            $executeRaw: jest.fn().mockResolvedValue(1),
            $executeRawUnsafe: jest.fn().mockResolvedValue(1),
            user: {
                findUnique: jest.fn(async () => ({ ...user })),
                update: jest.fn(async ({ data }) => {
                    for (const [key, value] of Object.entries(data)) {
                        user[key] = (value as any)?.increment != null ? user[key].add((value as any).increment) : value;
                    }
                    return { ...user };
                }),
                updateMany: jest.fn(async ({ where, data }) => {
                    const field = where.balance ? "balance" : "referralBalance";
                    if (user[field].lt(where[field].gte)) return { count: 0 };
                    user[field] = user[field].sub(data[field].decrement);
                    return { count: 1 };
                }),
            },
            payment: {
                findUnique: jest.fn(async ({ where }) => payments.find(p => p.id === where.id)),
                findUniqueOrThrow: jest.fn(async ({ where }) => payments.find(p => p.id === where.id)),
                count: jest.fn(async ({ where }) => payments.filter(p => p.status === "PAID" &&
                    (!where.NOT || p.metadata.contents[0].type !== "balance")).length),
                create: jest.fn(async ({ data }) => {
                    const p = { ...data, status: data.status || PaymentStatus.WAITING, userId: user.id, user: { ...user } };
                    payments.push(p); return p;
                }),
                update: jest.fn(async ({ where, data }) => Object.assign(payments.find(p => p.id === where.id), data)),
                updateMany: jest.fn(async ({ where, data }) => {
                    const p = payments.find(p => p.id === where.id && p.status === where.status);
                    if (!p) return { count: 0 };
                    Object.assign(p, data); return { count: 1 };
                }),
            },
            userPackage: { upsert: jest.fn().mockResolvedValue({ id: "qa-pkg" }), findUnique: jest.fn().mockResolvedValue({ id: "qa-pkg" }) },
            review: { findUnique: jest.fn().mockResolvedValue(null) },
            notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
        };
        db.$transaction = jest.fn(fn => {
            const next = lock.then(() => fn(db));
            lock = next.catch(() => undefined);
            return next;
        });
        service = new PaymentsService(
            { createInvoice: jest.fn().mockResolvedValue({ pay_url: "https://example.invalid/pay" }) } as any, {} as any,
            { getOrThrow: () => 3600 } as any, db, { getDiscounts: async () => ({ trial: 30, review: 30 }) } as any,
            {} as any, {} as any, { log: jest.fn(), error: jest.fn() } as any, { emit: jest.fn() } as any,
            { findById: async () => ({ ...user }) } as any, { awardReferralReward: jest.fn() } as any,
            {} as any, {} as any,
        );
    });

    function invoice(merchant = PaymentProvider.BALANCE, amount = 7) {
        return (service as any).buildAndSaveInvoice({
            asset: "USDT", merchant, amountUsd: amount,
            contents: [{ type: "resident", tariff: "ISP_USA", traffic: 1 }],
        }, user.id);
    }

    it("credits a repeated concurrent balance callback only once without a referrer", async () => {
        payments.push({ id: "balance-credit", status: PaymentStatus.WAITING, amountUsd: 5, userId: user.id, user,
            metadata: { contents: [{ type: "balance", amount: 5 }] } });
        await Promise.all([service.processPaidOrder(db, { order_id: "balance-credit" } as any),
            service.processPaidOrder(db, { order_id: "balance-credit" } as any)]);
        expect(user.balance.toNumber()).toBe(15);
        expect(db.user.update).toHaveBeenCalledTimes(1);
    });

    it("credits repeated traffic callbacks only once and stores a durable provider job", async () => {
        payments.push({ id: "traffic", status: PaymentStatus.WAITING, amountUsd: 7, userId: user.id, user,
            metadata: { contents: [{ type: "resident", tariff: "ISP_USA", traffic: 1 }] } });
        await Promise.all([service.processPaidOrder(db, { order_id: "traffic" } as any), service.processPaidOrder(db, { order_id: "traffic" } as any)]);
        expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(1);
        expect(payments[0].metadata.provisioningPending).toBe("ISP_USA");
        expect(payments[0].metadata.creditedTraffic).toBe(String(1024 ** 3));
    });

    it.each([PaymentProvider.BALANCE, PaymentProvider.REFERRAL_BALANCE])("prevents overspending %s in concurrent purchases", async merchant => {
        const result = await Promise.allSettled([invoice(merchant), invoice(merchant)]);
        expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
        expect(user[merchant === PaymentProvider.BALANCE ? "balance" : "referralBalance"].toNumber()).toBe(3);
        expect(payments).toHaveLength(1);
    });

    it("reserves the trial discount for only one of two concurrent invoices", async () => {
        user.trialDiscountAvailable = true;
        const result = await Promise.all([invoice(PaymentProvider.CRYPTO_BOT, 10), invoice(PaymentProvider.CRYPTO_BOT, 10)]);
        expect(result.map(p => Number(p.amountUsd)).sort((a, b) => a - b)).toEqual([7, 10]);
        expect(payments.filter(p => p.metadata.discount)).toHaveLength(1);
    });

    it("keeps the first-purchase discount after a paid balance topup", async () => {
        user.trialDiscountAvailable = true;
        payments.push({ status: "PAID", metadata: { contents: [{ type: "balance" }] } });
        await expect(service.getActiveDiscountForUser(user.id)).resolves.toEqual({ kind: "trial", pct: 30 });
    });

    it("restores a reserved discount only once when a pending invoice is cancelled", async () => {
        user.trialDiscountAvailable = true;
        const payment = await invoice(PaymentProvider.CRYPTO_BOT, 10);
        expect(user.trialDiscountAvailable).toBe(false);
        await (service as any).cancelPendingInvoice(payment.id);
        expect(user.trialDiscountAvailable).toBe(true);
        user.trialDiscountAvailable = false;
        await (service as any).cancelPendingInvoice(payment.id);
        expect(user.trialDiscountAvailable).toBe(false);
    });

    it.each(["RESIDENT_PREMIUM", "ISP_EU"])("rejects new invoices for unavailable tariff %s before any charge", async tariff => {
        await expect(service.createResidentInvoice({
            tariff, traffic: 1, asset: "USDT", merchant: PaymentProvider.BALANCE,
        } as any, user.id)).rejects.toThrow("errors.proxy_type_unavailable");
        expect(db.user.updateMany).not.toHaveBeenCalled();
        expect(db.payment.create).not.toHaveBeenCalled();
    });

    it.each(["RESIDENT_PREMIUM", "ISP_EU"])("rejects preset purchases for unavailable tariff %s", async type => {
        (service as any).packageService = { findById: jest.fn().mockResolvedValue({ id: "preset", type, price: 7 }) };
        await expect(service.createPackageInvoice({
            package: "preset", asset: "USDT", merchant: PaymentProvider.BALANCE,
        }, user.id)).rejects.toThrow("errors.proxy_type_unavailable");
        expect(db.payment.create).not.toHaveBeenCalled();
        expect(db.user.updateMany).not.toHaveBeenCalled();
    });
});
