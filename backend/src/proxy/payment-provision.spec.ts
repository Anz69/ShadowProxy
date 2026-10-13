import { ProxyService } from "./proxy.service";

describe("Paid provider provisioning retries", () => {
    let service: ProxyService;
    let metadata: any;
    let provider: any;
    let tx: any;
    beforeEach(() => {
        metadata = { provisioningPending: "PREMIUM_RESIDENTIAL", creditedTraffic: "1000" };
        tx = {
            $executeRaw: jest.fn().mockResolvedValue(1),
            payment: {
                findFirst: jest.fn(async () => ({ id: "payment-1", metadata })),
                update: jest.fn(async ({ data }) => { metadata = data.metadata; }),
            },
            user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ email: "qa@example.invalid", proxyEmpireSubUserEmail: "qa@example.invalid" }) },
        };
        provider = {
            getSubUserInfo: jest.fn().mockResolvedValue({ residential: { total: 100, used: 0, remaining: 100 } }),
            setSubUserBandwidth: jest.fn().mockResolvedValue(true),
        };
        service = new ProxyService({} as any, {} as any, {} as any, {} as any, {} as any, provider,
            {} as any, {} as any, { $transaction: async fn => fn(tx) } as any, {} as any, {} as any);
        jest.spyOn(service, "ensureProxyEmpireSubUser").mockResolvedValue("qa-token");
    });
    it("reuses the frozen total after lost provider acknowledgement instead of granting twice", async () => {
        provider.setSubUserBandwidth.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        const job = { userId: "qa-user", tariff: "PREMIUM_RESIDENTIAL", paymentId: "payment-1" };
        await expect(service.provisionPaidTraffic(job)).rejects.toThrow();
        expect(metadata.providerTargetTotal).toBe("1100");
        provider.getSubUserInfo.mockResolvedValue({ residential: { total: 1100, used: 500, remaining: 600 } });
        await service.provisionPaidTraffic(job);
        expect(provider.getSubUserInfo).toHaveBeenCalledTimes(1);
        expect(provider.setSubUserBandwidth.mock.calls.map(call => call[2])).toEqual([1100, 1100]);
    });
    it("never overwrites a newer quota by processing jobs out of order", async () => {
        tx.payment.findFirst.mockResolvedValue({ id: "earlier-payment", metadata });
        await expect(service.provisionPaidTraffic({ userId: "qa-user", tariff: "PREMIUM_RESIDENTIAL", paymentId: "payment-1" })).rejects.toThrow();
        expect(provider.setSubUserBandwidth).not.toHaveBeenCalled();
    });
    it("funds the first Mobile purchase when a valid sub-user has no mobile quota yet", async () => {
        metadata = { provisioningPending: "MOBILE", creditedTraffic: "1000" };
        provider.getSubUserInfo.mockResolvedValue({ residential: { total: 1, used: 0, remaining: 1 } });
        await service.provisionPaidTraffic({ userId: "qa-user", tariff: "MOBILE", paymentId: "payment-1" });
        expect(metadata.providerTargetTotal).toBe("1000");
        expect(provider.setSubUserBandwidth).toHaveBeenCalledWith("qa@example.invalid", "mobile", 1000);
    });
    it("never treats an unavailable provider response as an unfunded tariff", async () => {
        provider.getSubUserInfo.mockResolvedValue(null);
        await expect(service.provisionPaidTraffic({ userId: "qa-user", tariff: "MOBILE", paymentId: "payment-1" })).rejects.toThrow("Provider counters unavailable");
        expect(provider.setSubUserBandwidth).not.toHaveBeenCalled();
    });
});
