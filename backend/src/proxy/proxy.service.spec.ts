import { ProxyService } from "./proxy.service";

describe("ProxyService.parseAvailableLocations", () => {
    it("fetches the shared Mango country list once and reuses it", async () => {
        const mangoProxyProvider = {
            getAvailableLocations: jest.fn().mockResolvedValue(["us", "nl", "rsa"]),
        };
        const proxyEmpireProvider = {
            getAvailableLocations: jest.fn().mockResolvedValue(["us", "gb"]),
        };
        const ispEuProvider = { getCountries: jest.fn().mockReturnValue(["NL"]) };
        const service = new ProxyService(
            {} as any,
            mangoProxyProvider as any,
            {} as any,
            {} as any,
            {} as any,
            proxyEmpireProvider as any,
            ispEuProvider as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
        );

        await service.parseAvailableLocations();

        expect(mangoProxyProvider.getAvailableLocations).toHaveBeenCalledTimes(1);
        expect(service.availableLocations.premium).toEqual(["us", "nl"]);
        expect(service.availableLocations.resident).toEqual(["us", "nl"]);
        expect(service.availableLocations.isp).toEqual(["us", "nl"]);
        expect(service.availableLocations.residentialLite).toEqual(["us", "nl"]);
        expect(service.availableLocations.premiumResidential).toEqual(["us", "gb"]);
        expect(service.availableLocations.ispEu).toEqual(["nl"]);
    });
});

describe("ProxyEmpire customer credential isolation", () => {
    it.each(["issuePremiumResidentialProxy", "issueMobileV2Proxy"] as const)(
        "%s never falls back to the master token after sub-user creation fails",
        async method => {
            const provider = { generateProxyList: jest.fn() };
            const users = { findById: jest.fn().mockResolvedValue({
                id: "qa-user", premiumResidentialTrafficLeft: "1000", mobileTrafficLeft: "1000",
            }) };
            const service = new ProxyService(
                {} as any, {} as any, {} as any, {} as any, {} as any, provider as any,
                {} as any, users as any, {} as any, {} as any, {} as any,
            );
            jest.spyOn(service, "ensureProxyEmpireSubUser").mockResolvedValue(null);
            await expect(service[method]({ quantity: 1, location: "US" } as any, "qa-user")).rejects.toThrow("Трафик сохранён");
            expect(provider.generateProxyList).not.toHaveBeenCalled();
        },
    );
});

describe("ProxyEmpire reconciliation failure logging", () => {
    let service: ProxyService;
    let provider: { getSubUserInfo: jest.Mock };
    let logger: { error: jest.Mock; log: jest.Mock };
    let db: any;

    beforeEach(() => {
        jest.spyOn(Date, "now").mockReturnValue(10000000);
        provider = { getSubUserInfo: jest.fn().mockResolvedValue({
            residential: { total: 10485760, used: 0, remaining: 0 },
        }) };
        logger = { error: jest.fn().mockResolvedValue(undefined), log: jest.fn().mockResolvedValue(undefined) };
        db = {
            user: {
                findMany: jest.fn().mockResolvedValue([{
                    id: "qa-user", email: "qa@example.invalid", proxyEmpireSubUserEmail: "qa@example.invalid",
                    premiumResidentialTrafficLeft: "1000", mobileTrafficLeft: "0",
                    proxyEmpireResiUsedSnapshot: "0", proxyEmpireMobileUsedSnapshot: "0",
                }]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            payment: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        service = new ProxyService(
            {} as any, {} as any, {} as any, {} as any, {} as any, provider as any,
            {} as any, {} as any, db, { get: () => undefined } as any, logger as any,
        );
    });

    afterEach(() => jest.restoreAllMocks());

    it("continues polling but logs an identical invalid quota only once an hour", async () => {
        await service.syncProxyEmpireUsage();
        await service.syncProxyEmpireUsage();
        expect(provider.getSubUserInfo).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(db.user.updateMany).not.toHaveBeenCalled();
        jest.mocked(Date.now).mockReturnValue(13600000);
        await service.syncProxyEmpireUsage();
        expect(logger.error).toHaveBeenCalledTimes(2);
    });

    it("logs a different failure immediately and isolates suppression per user", async () => {
        await service.syncProxyEmpireUsage();
        provider.getSubUserInfo.mockRejectedValueOnce(new Error("new failure"));
        await service.syncProxyEmpireUsage();
        expect(logger.error).toHaveBeenCalledTimes(2);
        db.user.findMany.mockResolvedValue([{
            id: "another-user", email: "another@example.invalid", proxyEmpireSubUserEmail: "another@example.invalid",
            premiumResidentialTrafficLeft: "1000", mobileTrafficLeft: "0",
            proxyEmpireResiUsedSnapshot: "0", proxyEmpireMobileUsedSnapshot: "0",
        }]);
        await service.syncProxyEmpireUsage();
        expect(logger.error).toHaveBeenCalledTimes(3);
    });

    it("logs a recurrence immediately after recovery without charging a preserved balance", async () => {
        await service.syncProxyEmpireUsage();
        provider.getSubUserInfo.mockResolvedValueOnce({
            residential: { total: 1000, used: 0, remaining: 1000 },
        });
        await service.syncProxyEmpireUsage();
        await service.syncProxyEmpireUsage();
        expect(logger.error).toHaveBeenCalledTimes(2);
        expect(db.user.updateMany).not.toHaveBeenCalled();
    });

    it("does not reconcile while paid provider provisioning is pending", async () => {
        db.payment.findFirst.mockResolvedValue({ id: "pending-payment" });
        await service.syncProxyEmpireUsage();
        expect(provider.getSubUserInfo).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
        expect(db.user.updateMany).not.toHaveBeenCalled();
    });
});
