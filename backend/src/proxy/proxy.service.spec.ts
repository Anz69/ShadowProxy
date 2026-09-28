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
