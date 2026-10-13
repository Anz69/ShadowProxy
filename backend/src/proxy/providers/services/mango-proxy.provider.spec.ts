import axios from "axios";
import { MangoProxyProvider } from "./mango-proxy.provider";

describe("MangoProxyProvider account provisioning", () => {
    const post = jest.fn();
    let provider: MangoProxyProvider;
    let userService: { findById: jest.Mock; updateById: jest.Mock };
    let logger: { log: jest.Mock; error: jest.Mock };

    beforeEach(() => {
        jest.spyOn(axios, "create").mockReturnValue({
            interceptors: { request: { use: jest.fn() } },
            post,
        } as any);
        post.mockReset();
        userService = {
            findById: jest.fn().mockResolvedValue({ premiumUsername: "" }),
            updateById: jest.fn().mockResolvedValue(undefined),
        };
        logger = { log: jest.fn().mockResolvedValue(undefined), error: jest.fn().mockResolvedValue(undefined) };
        provider = new MangoProxyProvider(
            { getOrThrow: (key: string) => key, get: (key: string, fallback: string) => key === "MANGO_MODE" ? "gateway" : fallback } as any,
            userService as any,
            logger as any,
            {} as any,
        );
    });

    afterEach(() => jest.restoreAllMocks());

    it("persists credentials when Mango returns HTTP 200 for both creation calls", async () => {
        post.mockResolvedValue({ status: 200, data: { code: "1", msg: "success" } });

        await expect(provider.createUser({ userId: "user-1", type: "RESIDENT_PREMIUM" as any })).resolves.toBe(true);

        expect(post).toHaveBeenCalledTimes(2);
        expect(post.mock.calls.map(([path]) => path)).toEqual(["/create_user", "/add_proxy_account"]);
        expect(userService.updateById).toHaveBeenCalledWith(
            "user-1",
            expect.objectContaining({ premiumUsername: expect.stringMatching(/^[^:]+:[^:]+:[^:]+$/) }),
        );
    });

    it("does not create a proxy account when creating the Mango user fails", async () => {
        post.mockRejectedValueOnce(new Error("upstream unavailable"));

        await expect(provider.createUser({ userId: "user-1", type: "RESIDENT_PREMIUM" as any })).resolves.toBe(false);

        expect(post).toHaveBeenCalledTimes(1);
        expect(userService.updateById).not.toHaveBeenCalled();
    });

    it("does not treat an HTTP 200 application error as a successful Mango user creation", async () => {
        post.mockResolvedValueOnce({ status: 200, data: { code: "0", msg: "rejected" } });

        await expect(provider.createUser({ userId: "user-1", type: "RESIDENT_PREMIUM" as any })).resolves.toBe(false);

        expect(post).toHaveBeenCalledTimes(1);
        expect(userService.updateById).not.toHaveBeenCalled();
    });

    it("does not persist credentials when Mango rejects proxy-account creation", async () => {
        post
            .mockResolvedValueOnce({ status: 200, data: { code: "1", msg: "user created" } })
            .mockResolvedValueOnce({ status: 200, data: { code: "0", msg: "account rejected" } });

        await expect(provider.createUser({ userId: "user-1", type: "RESIDENT_PREMIUM" as any })).resolves.toBe(false);

        expect(post).toHaveBeenCalledTimes(2);
        expect(userService.updateById).not.toHaveBeenCalled();
    });

    it("bounds Mango API requests when the upstream stops responding", () => {
        expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ timeout: 8000 }));
    });

    it("does not top up when Mango user_info has no verified remaining flow", async () => {
        post.mockResolvedValueOnce({ status: 200, data: { code: "0" } });

        await provider.ensureMangoFlow("mango-user:account:password");

        expect(post).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("/user_info returned invalid flow"));
    });

    it("does not report an unsuccessful Mango top-up as completed", async () => {
        post
            .mockResolvedValueOnce({ status: 200, data: { code: "1", ret_data: { last_flow: 0 } } })
            .mockResolvedValueOnce({ status: 200, data: { code: "0", msg: "rejected" } });

        await provider.ensureMangoFlow("mango-user:account:password");

        expect(post).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("/add_user_flow failed"));
        expect(logger.log).not.toHaveBeenCalledWith("SYSTEM", expect.stringContaining("Mango unlock:"));
    });
});
