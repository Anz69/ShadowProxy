import axios from "axios";
import { ProxyEmpireProvider } from "./proxy-empire.provider";

describe("ProxyEmpireProvider.generateProxyList", () => {
    const post = jest.fn();
    let provider: ProxyEmpireProvider;

    beforeEach(() => {
        jest.spyOn(axios, "create").mockReturnValue({ post } as any);
        post.mockReset();
        provider = new ProxyEmpireProvider(
            { get: (key: string, fallback?: string) => fallback ?? key } as any,
            { log: jest.fn(), error: jest.fn() } as any,
        );
    });

    afterEach(() => jest.restoreAllMocks());

    it("parses the current top-level host:port:username:password response", async () => {
        post.mockResolvedValue({
            data: {
                message: "Proxy list generated successfully",
                count: 1,
                proxies: ["gateway.example:5000:customer-user:customer-pass"],
            },
        });

        await expect(provider.generateProxyList({ proxyType: "mobile", country: "US" })).resolves.toEqual([
            {
                host: "v2.proxyempire.io",
                port: 5000,
                username: "customer-user",
                password: "customer-pass",
            },
        ]);
    });

    it("still parses the legacy nested username:password:host:port response", async () => {
        post.mockResolvedValue({
            data: {
                data: {
                    proxies: ["customer-user:pass:with:colon:gateway.example:5000"],
                },
            },
        });

        await expect(provider.generateProxyList({ proxyType: "residential" })).resolves.toEqual([
            {
                host: "v2.proxyempire.io",
                port: 5000,
                username: "customer-user",
                password: "pass:with:colon",
            },
        ]);
    });

    it("ignores malformed list entries", async () => {
        post.mockResolvedValue({ data: { proxies: ["broken", "gateway.example:99999:user:pass"] } });

        await expect(provider.generateProxyList({ proxyType: "residential" })).resolves.toEqual([]);
    });
});
