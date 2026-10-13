import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user.service";

describe("UserService", () => {
    let service: UserService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UserService],
        })
            .useMocker(() => ({}))
            .compile();

        service = module.get<UserService>(UserService);
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    it("uses a cryptographic random key even when user and time do not change", async () => {
        const update = jest.fn().mockResolvedValue({});
        const userService = new UserService({ user: { update } } as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        const now = jest.spyOn(Date, "now").mockReturnValue(1000);
        const first = await userService.generateApiKey("user-1");
        const second = await userService.generateApiKey("user-1");
        expect(first).toMatch(/^[a-f0-9]{64}$/);
        expect(first).not.toBe(second);
        now.mockRestore();
    });

    it("requests only public linked-account fields in the profile", async () => {
        const findUnique = jest.fn().mockResolvedValue({ id: "user-1", accounts: [] });
        const userService = new UserService({ user: { findUnique } } as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        await userService.findById("user-1", true, true);
        const selection = (findUnique.mock.calls as any)[0][0].include.accounts.select;
        expect(selection.provider).toBe(true);
        expect(selection).not.toHaveProperty("accessToken");
        expect(selection).not.toHaveProperty("refreshToken");
    });

    it("omits provider secrets and OAuth tokens from API-key authentication", async () => {
        const findUnique = jest.fn().mockResolvedValue({ id: "user-1", accounts: [] });
        const userService = new UserService({ user: { findUnique } } as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        await userService.findByApiKey("isolated-qa-key");
        const query = (findUnique.mock.calls as any)[0][0];
        expect(query.omit.proxyEmpireSubUserToken).toBe(true);
        expect(query.omit.password).toBe(true);
        expect(query.include.accounts.select).not.toHaveProperty("accessToken");
        expect(query.include.accounts.select).not.toHaveProperty("refreshToken");
    });

    it("atomically accumulates concurrent ISP traffic credits instead of overwriting one", async () => {
        let balance = 0n;
        const executeRaw = jest.fn((_query: string, amount: string, userId: string) => {
            expect(userId).toBe("user-1");
            balance += BigInt(amount);
            return Promise.resolve(1);
        });
        const prisma = { $executeRawUnsafe: executeRaw };
        const packageService = { createPackageIfNotExists: jest.fn().mockResolvedValue({}) };
        const userService = new UserService(prisma as any, {} as any, {} as any, packageService as any, {} as any, {} as any, {} as any);
        jest.spyOn(userService, "findById").mockResolvedValue({ id: "user-1", ispUsaTrafficLeft: "0" } as any);

        await Promise.all([
            userService.distributeTraffic({ tariff: "ISP_USA", traffic: "100", userId: "user-1" }),
            userService.distributeTraffic({ tariff: "ISP_USA", traffic: "100", userId: "user-1" }),
        ]);

        expect(balance).toBe(200n);
        expect(executeRaw).toHaveBeenCalledTimes(2);
        expect(executeRaw.mock.calls.every(([query]) => query.includes('"isp_usa_traffic_left"'))).toBe(true);
    });

    it("changes only the requested Lite balance and preserves hidden IPv6/other balances", async () => {
        const emitAsync = jest.fn().mockResolvedValue([]);
        const packageService = { createPackageIfNotExists: jest.fn() };
        const userService = new UserService({} as any, {} as any, { emitAsync } as any, packageService as any, {} as any, {} as any, {} as any);
        const existing = {
            id: "user-1", premiumTrafficLeft: "123456789", mobileGbTrafficLeft: "1234567",
            ipv6GbTrafficLeft: "7654321", premiumResidentialTrafficLeft: "0",
            mobileTrafficLeft: "0", ispUsaTrafficLeft: "0", ispEuTrafficLeft: "0",
            residentialLiteTrafficLeft: "0", premiumUsername: "already-created",
        };
        jest.spyOn(userService, "findById").mockResolvedValue(existing as any);
        const update = jest.spyOn(userService, "updateById");

        await userService.modifyUserTraffic({ residentialLiteTrafficLeft: 2 }, "user-1");

        expect(emitAsync).toHaveBeenCalledTimes(1);
        expect(emitAsync).toHaveBeenCalledWith("user.distribute_traffic", {
            tariff: "RESIDENTIAL_LITE", traffic: String(2 * 1024 ** 3), userId: "user-1",
        });
        expect(packageService.createPackageIfNotExists).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(existing.ipv6GbTrafficLeft).toBe("7654321");
    });

    it("allows only one concurrent trial claim and issues traffic once", async () => {
        let trialClaimed = false;
        const updateMany = jest.fn(() => {
            if (trialClaimed) return Promise.resolve({ count: 0 });
            trialClaimed = true;
            return Promise.resolve({ count: 1 });
        });
        const executeRaw = jest.fn().mockResolvedValue(1);
        const upsertPackage = jest.fn().mockResolvedValue({ id: "package-1" });
        const prisma = {
            account: { findMany: jest.fn().mockResolvedValue([]) },
            $transaction: jest.fn((callback: (tx: any) => Promise<unknown>) =>
                callback({
                    user: { updateMany },
                    trialIdentity: { createMany: jest.fn(), findMany: jest.fn() },
                    userPackage: { upsert: upsertPackage },
                    $executeRawUnsafe: executeRaw,
                }),
            ),
        };
        const emitAsync = jest.fn().mockResolvedValue(true);
        const packageService = {
            getUserPackages: jest.fn().mockResolvedValue([{ id: "package-1", type: "ISP_USA" }]),
        };
        const notificationService = { create: jest.fn().mockResolvedValue(undefined) };
        const userService = new UserService(
            prisma as any,
            {} as any,
            { emitAsync } as any,
            packageService as any,
            notificationService as any,
            { get: jest.fn().mockReturnValue("gateway") } as any,
            {} as any,
        );
        jest.spyOn(userService, "findById").mockResolvedValue({
            id: "user-1",
            trial: null,
            authMethod: "GOOGLE",
            premiumUsername: "",
        } as any);

        const results = await Promise.allSettled([userService.getTrial("user-1", "ISP_USA"), userService.getTrial("user-1", "ISP_USA")]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
        expect(updateMany).toHaveBeenCalledTimes(2);
        expect(upsertPackage).toHaveBeenCalledTimes(1);
        expect(executeRaw).toHaveBeenCalledTimes(1);
        expect(executeRaw).toHaveBeenCalledWith(expect.stringContaining('"isp_usa_traffic_left"'), String(100 * 1024 * 1024), "user-1");
        expect(emitAsync).not.toHaveBeenCalled();
    });
});
