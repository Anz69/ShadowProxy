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

describe("ProxyEmpireProvider quota failure logging", () => {
    it("deduplicates repeated failures but logs changed errors and recovery failures immediately", async () => {
        const get = jest.fn();
        const error = jest.fn();
        jest.spyOn(axios, "create").mockReturnValue({ get } as any);
        try {
            const provider = new ProxyEmpireProvider({ get: () => "" } as any, { error } as any);
            get.mockRejectedValue({ response: { status: 403, data: { message: "This user has been deleted" } } });
            await provider.getSubUserInfo("qa@example.invalid");
            await provider.getSubUserInfo("qa@example.invalid");
            expect(error).toHaveBeenCalledTimes(1);
            get.mockRejectedValue({ response: { status: 500, data: { message: "Unavailable" } } });
            await provider.getSubUserInfo("qa@example.invalid");
            expect(error).toHaveBeenCalledTimes(2);
            get.mockResolvedValue({ data: { data: { residential: { bandwidth: { total: 100, used: 0, remaining: 100 } } } } });
            await expect(provider.getSubUserInfo("qa@example.invalid")).resolves.toMatchObject({ residential: { remaining: 100 } });
            get.mockRejectedValue({ response: { status: 500, data: { message: "Unavailable" } } });
            await provider.getSubUserInfo("qa@example.invalid");
            expect(error).toHaveBeenCalledTimes(3);
        } finally {
            jest.restoreAllMocks();
        }
    });
});

describe("ProxyEmpireProvider existing account safety", () => {
    it("never deletes an existing paid sub-user after a duplicate creation response", async () => {
        const post = jest.fn().mockRejectedValue({
            response: { status: 422, data: { errors: { email: ["The email has already been taken."] } } },
        });
        const remove = jest.fn();
        jest.spyOn(axios, "create").mockReturnValue({ post, delete: remove } as any);
        try {
            const provider = new ProxyEmpireProvider({ get: () => "" } as any, { error: jest.fn() } as any);
            await expect(provider.createSubUser("qa@example.invalid", "QA")).resolves.toBeNull();
            expect(remove).not.toHaveBeenCalled();
            expect(post).toHaveBeenCalledTimes(1);
        } finally {
            jest.restoreAllMocks();
        }
    });
});

describe("ProxyEmpireProvider first tariff funding", () => {
    afterEach(() => jest.restoreAllMocks());
    it("adds the initial mobile quota only after a successful sub-user lookup", async () => {
        const get = jest.fn().mockResolvedValue({ data: { data: { residential: { bandwidth: { total: 1, used: 0, remaining: 1 } } } } });
        const put = jest.fn().mockResolvedValue({});
        jest.spyOn(axios, "create").mockReturnValue({ get, put } as any);
        const provider = new ProxyEmpireProvider({ get: () => "" } as any, { log: jest.fn(), error: jest.fn() } as any);
        await expect(provider.setSubUserBandwidth("qa@example.invalid", "mobile", 1000)).resolves.toBe(true);
        expect(put).toHaveBeenCalledWith("/subusers/qa%40example.invalid", {
            bandwidth_update: { action: "add", type: "mobile", amount: 1000 },
        });
    });
    it("does not add quota when the sub-user lookup fails", async () => {
        const get = jest.fn().mockRejectedValue(new Error("Unavailable"));
        const put = jest.fn();
        jest.spyOn(axios, "create").mockReturnValue({ get, put } as any);
        const provider = new ProxyEmpireProvider({ get: () => "" } as any, { log: jest.fn(), error: jest.fn() } as any);
        await expect(provider.setSubUserBandwidth("qa@example.invalid", "mobile", 1000)).resolves.toBe(false);
        expect(put).not.toHaveBeenCalled();
    });
});
