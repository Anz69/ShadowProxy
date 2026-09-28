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

    it("atomically accumulates concurrent ISP traffic credits instead of overwriting one", async () => {
        let balance = 0n;
        const executeRaw = jest.fn(async (_query: string, amount: string, userId: string) => {
            expect(userId).toBe("user-1");
            balance += BigInt(amount);
            return 1;
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
});
