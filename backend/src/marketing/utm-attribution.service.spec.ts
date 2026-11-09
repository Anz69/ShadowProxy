import { UtmAttributionService } from "./utm-attribution.service";

describe("UtmAttributionService", () => {
    function serviceWith(campaignBySlug: any) {
        const prisma = { marketingCampaign: { findUnique: jest.fn().mockResolvedValue(campaignBySlug) } };
        return new UtmAttributionService(prisma as any);
    }

    it("обрезает пробелы и лимит 200 символов", async () => {
        const service = serviceWith(null);
        const touch = { utmSource: "  google  ", utmMedium: "paid", utmCampaign: "camp-123" };
        await expect(service.resolve(touch)).resolves.toEqual({ utmSource: "google", utmMedium: "paid", utmCampaign: "camp-123" });
    });

    it("возвращает пустой объект, когда UTM-меток нет", async () => {
        const service = serviceWith(null);
        await expect(service.resolve({})).resolves.toEqual({});
        await expect(service.resolve(undefined)).resolves.toEqual({});
    });

    it("связывает пользователя с кампанией по utm_campaign (регистр не важен)", async () => {
        const service = serviceWith({ id: "campaign-id", slug: "telegram-november-ab12cd" });
        await expect(service.resolve({ utmSource: "telegram", utmMedium: "paid", utmCampaign: "TELEGRAM-NOVEMBER-AB12CD" })).resolves.toEqual({
            utmSource: "telegram",
            utmMedium: "paid",
            utmCampaign: "TELEGRAM-NOVEMBER-AB12CD",
            utmCampaignId: "campaign-id",
        });
    });

    it("не привязывает к кампании, если slug не найден", async () => {
        const service = serviceWith(null);
        await expect(service.resolve({ utmCampaign: "unknown-slug" })).resolves.toEqual({ utmCampaign: "unknown-slug" });
    });

    it("parseCookie разбирает валидный JSON и игнорирует битый", () => {
        const service = serviceWith(null);
        expect(service.parseCookie(JSON.stringify({ utmSource: "google" }))).toEqual({ utmSource: "google" });
        expect(service.parseCookie("{broken")).toBeUndefined();
        expect(service.parseCookie(undefined)).toBeUndefined();
    });
});
