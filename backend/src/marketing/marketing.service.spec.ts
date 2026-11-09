import { Prisma } from "@prisma/client";
import { MarketingService } from "./marketing.service";

/** Мокаем только то, что использует MarketingService.list(). */
function serviceWith(data: { campaign?: any; users?: any[]; payments?: any[]; referrals?: any[]; expenses?: any[] }) {
    const prisma = {
        marketingCampaign: { findMany: jest.fn().mockResolvedValue(data.campaign ?? []) },
        $queryRaw: jest.fn((strings: TemplateStringsArray, ...args: any[]) => {
            const sql = strings.join("?");
            if (sql.includes("FROM payments p")) return Promise.resolve(data.payments ?? []);
            if (sql.includes("FROM users r")) return Promise.resolve(data.referrals ?? []);
            if (sql.includes("FROM users")) return Promise.resolve(data.users ?? []);
            return Promise.resolve([]);
        }),
        marketingCampaignExpense: { groupBy: jest.fn().mockResolvedValue(data.expenses ?? []) },
    };
    const logger = { log: jest.fn().mockResolvedValue(undefined), error: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue("https://dev.shadowproxy.io") };
    return new MarketingService(prisma as any, logger as any, config as any);
}

describe("MarketingService.list()", () => {
    const campaign = {
        id: "c1",
        name: "Telegram Ноябрь",
        source: "Telegram Ads",
        utmSource: "telegram",
        slug: "telegram-noyabr-abc123",
        createdAt: new Date("2026-11-01T00:00:00Z"),
        updatedAt: new Date("2026-11-01T00:00:00Z"),
    };

    it("считает CPA, LTV и все метрики карточки", async () => {
        const service = serviceWith({
            campaign: [campaign],
            users: [{ cid: "c1", registrations: 10, trials: 4 }],
            payments: [{ cid: "c1", payers: 3, payments: 5, revenue: 150 }],
            referrals: [{ cid: "c1", referrals: 7 }],
            expenses: [{ campaignId: "c1", _sum: { amount: new Prisma.Decimal("40") } }],
        });

        const list = await service.list();
        expect(list).toHaveLength(1);
        const stats = list[0].stats;
        expect(stats.registrations).toBe(10);
        expect(stats.trials).toBe(4);
        expect(stats.payers).toBe(3);
        expect(stats.referrals).toBe(7);
        expect(stats.spend).toBe(40);
        expect(stats.revenue).toBe(150);
        // CPA = расходы / регистрации = 40 / 10 = 4
        expect(stats.cpa).toBe(4);
        // LTV = выручка / регистрации = 150 / 10 = 15
        expect(stats.avgLtv).toBe(15);
        // ROMI = (150 - 40) / 40 * 100 = 275
        expect(stats.romi).toBe(275);
        expect(list[0].link).toBe("https://dev.shadowproxy.io/?utm_source=telegram&utm_medium=paid&utm_campaign=telegram-noyabr-abc123");
    });

    it("не делит на ноль — CPA/LTV равны null без регистраций", async () => {
        const service = serviceWith({
            campaign: [campaign],
            users: [],
            payments: [],
            referrals: [],
            expenses: [{ campaignId: "c1", _sum: { amount: new Prisma.Decimal("10") } }],
        });

        const [item] = await service.list();
        expect(item.stats.cpa).toBeNull();
        expect(item.stats.avgLtv).toBeNull();
        expect(item.stats.spend).toBe(10);
    });

    it("возвращает пустой массив без кампаний", async () => {
        const service = serviceWith({});
        await expect(service.list()).resolves.toEqual([]);
    });
});
