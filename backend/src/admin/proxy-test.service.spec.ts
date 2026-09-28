import axios from "axios";
import { ProxyType } from "@prisma/client";
import { ProxyTestService } from "./proxy-test.service";

describe("ProxyTestService gateway accounting checks", () => {
    it("waits for CORE acknowledgement, not only live gateway counters", async () => {
        const service = new ProxyTestService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        const getSpy = jest
            .spyOn(axios, "get")
            .mockResolvedValueOnce({ data: { in_bytes: 1_000_000, out_bytes: 0, reported_in_bytes: 0, reported_out_bytes: 0 } } as any)
            .mockResolvedValueOnce({ data: { in_bytes: 1_000_000, out_bytes: 0, reported_in_bytes: 1_000_000, reported_out_bytes: 0 } } as any);

        const stats = await (service as any).waitForGatewayStats("gateway", "token", "qa-login", 1_000_000);

        expect(getSpy).toHaveBeenCalledTimes(2);
        expect(stats.reportedInBytes).toBe(1_000_000);
        getSpy.mockRestore();
    });

    it("never falls back to a customer's active Mango proxy for QA", async () => {
        const prisma = {
            proxy: {
                findMany: jest.fn(),
                groupBy: jest.fn().mockResolvedValue([{ type: ProxyType.RESIDENT_PREMIUM, _count: { _all: 3 } }]),
            },
        };
        const config = { get: jest.fn(() => undefined) };
        const service = new ProxyTestService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, config as any);

        const targets = await (service as any).buildTargets(ProxyType.RESIDENT_PREMIUM, null, 1);
        const catalog = await service.getCatalog();

        expect(prisma.proxy.findMany).not.toHaveBeenCalled();
        expect(targets).toHaveLength(1);
        expect(targets[0].unavailableReason).toContain("отдельные MANGO_QA_UPSTREAM_");
        expect(catalog.types.find((item) => item.type === ProxyType.RESIDENT_PREMIUM)).toMatchObject({
            activeProxyCount: 3,
            safeQaAvailable: false,
        });
    });

    it("uses dedicated Mango QA credentials when explicitly configured", async () => {
        const configValues: Record<string, string> = {
            MANGO_QA_UPSTREAM_HOST: "mango-qa.example.test",
            MANGO_QA_UPSTREAM_PORT: "3128",
            MANGO_QA_UPSTREAM_USERNAME: "qa-user",
            MANGO_QA_UPSTREAM_PASSWORD: "qa-password",
        };
        const prisma = { proxy: { findMany: jest.fn() } };
        const config = { get: jest.fn((key: string) => configValues[key]) };
        const service = new ProxyTestService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, config as any);

        const targets = await (service as any).buildTargets(ProxyType.RESIDENT_PREMIUM, "DE", 1);

        expect(prisma.proxy.findMany).not.toHaveBeenCalled();
        expect(targets[0]).toMatchObject({
            type: ProxyType.RESIDENT_PREMIUM,
            country: "DE",
            source: "provider",
            upstream: {
                host: "mango-qa.example.test",
                port: 3128,
                username: "qa-user",
                password: "qa-password",
            },
        });
    });
});
