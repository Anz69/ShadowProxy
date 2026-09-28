import { Prisma, ProxyStatus, ProxyType } from "@prisma/client";
import { ProxyNodeController } from "./proxy-node.controller";

describe("ProxyNodeController traffic accounting", () => {
    const activeHost = "198.51.100.10";
    let controller: ProxyNodeController;
    let tx: any;
    let prisma: any;
    let loggerService: any;

    beforeEach(() => {
        tx = {
            proxyTrafficBatchReceipt: { create: jest.fn().mockResolvedValue({}) },
            proxy: {
                findFirst: jest.fn().mockResolvedValue({
                    id: "proxy-1",
                    type: ProxyType.ISP_USA,
                    userId: "user-1",
                    user: { id: "user-1" },
                    userPackageId: null,
                    userPort: 10000,
                    serverHost: activeHost,
                    userLogin: "qa-login",
                    status: ProxyStatus.ACTIVE,
                }),
                findMany: jest.fn().mockResolvedValue([]),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            $executeRawUnsafe: jest.fn().mockResolvedValue(1),
            $queryRawUnsafe: jest.fn().mockResolvedValue([{ balance: "1000" }]),
            userPackage: { update: jest.fn().mockResolvedValue({}) },
            trafficLog: { upsert: jest.fn().mockResolvedValue({}) },
        };
        prisma = {
            proxyServer: { findFirst: jest.fn().mockResolvedValue({ host: activeHost, token: "server-token" }) },
            $transaction: jest.fn(async (fn) => fn(tx)),
        };
        loggerService = {
            log: jest.fn().mockResolvedValue(undefined),
            logTraffic: jest.fn().mockResolvedValue(undefined),
        };
        controller = new ProxyNodeController({} as any, prisma, loggerService, { syncActivePortsWithServers: jest.fn().mockResolvedValue(undefined) } as any);
    });

    it.each([
        [ProxyType.ISP_USA, "isp_usa_traffic_left"],
        [ProxyType.ISP_EU, "isp_eu_traffic_left"],
        [ProxyType.RESIDENTIAL_LITE, "residential_lite_traffic_left"],
    ])("debits the matching balance column for %s", async (type, column) => {
        tx.proxy.findFirst.mockResolvedValueOnce({
            id: "proxy-1",
            type,
            userId: "user-1",
            user: { id: "user-1" },
            userPackageId: null,
            userPort: 10000,
            serverHost: activeHost,
            userLogin: "qa-login",
            status: ProxyStatus.ACTIVE,
        });
        await controller.receiveTraffic(
            {
                server_id: activeHost,
                batch_id: "a".repeat(32),
                logs: [{ user: "qa-login", in_bytes: 100, out_bytes: 25 }],
            },
            { headers: { authorization: "Bearer server-token" }, ip: "127.0.0.1" },
        );

        const [query, bytes, userId] = tx.$queryRawUnsafe.mock.calls[0];
        expect(query).toContain(`"${column}"`);
        expect(bytes).toBe("125");
        expect(userId).toBe("user-1");
        expect(tx.proxyTrafficBatchReceipt.create).toHaveBeenCalledWith({
            data: { id: "a".repeat(32), serverHost: activeHost },
        });
    });

    it("acknowledges a retried batch without charging it again", async () => {
        tx.proxyTrafficBatchReceipt.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));

        const result = await controller.receiveTraffic(
            {
                server_id: activeHost,
                batch_id: "b".repeat(32),
                logs: [{ user: "qa-login", in_bytes: 100, out_bytes: 25 }],
            },
            { headers: { authorization: "Bearer server-token" }, ip: "127.0.0.1" },
        );

        expect(result).toEqual({ success: true, duplicate: true, message: "Traffic batch already applied" });
        expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
        expect(loggerService.logTraffic).not.toHaveBeenCalled();
    });

    it("rejects reports from an unknown gateway host", async () => {
        prisma.proxyServer.findFirst.mockResolvedValueOnce(null);
        await expect(controller.receiveTraffic({ server_id: "203.0.113.99", logs: [] }, { headers: {} })).rejects.toThrow("Неизвестная прокси-нода");
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
