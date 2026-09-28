import axios from "axios";
import { ConflictException } from "@nestjs/common";
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

    it("rejects a concurrent run while the first request is still loading gateway state", async () => {
        let resolveGateways!: (value: Array<{ host: string; token: string }>) => void;
        const gatewayLookup = new Promise<Array<{ host: string; token: string }>>((resolve) => {
            resolveGateways = resolve;
        });
        const prisma = { proxyServer: { findMany: jest.fn(() => gatewayLookup) } };
        const proxyServerService = { getPublicHost: jest.fn((host: string) => host) };
        const service = new ProxyTestService(prisma as any, proxyServerService as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        jest.spyOn(service as any, "buildTargets").mockResolvedValue([]);
        jest.spyOn(service as any, "persistJob").mockResolvedValue(undefined);
        jest.spyOn(service as any, "execute").mockResolvedValue(undefined);

        const firstRun = service.createRun({} as any);
        await expect(service.createRun({} as any)).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.proxyServer.findMany).toHaveBeenCalledTimes(1);

        resolveGateways([{ host: "gateway.example.test", token: "gateway-token" }]);
        await expect(firstRun).resolves.toMatchObject({ status: "queued" });
    });

    it("releases the run reservation after its initial persistence fails", async () => {
        const prisma = {
            proxyServer: {
                findMany: jest.fn().mockResolvedValue([{ host: "gateway.example.test", token: "gateway-token" }]),
            },
        };
        const proxyServerService = { getPublicHost: jest.fn((host: string) => host) };
        const service = new ProxyTestService(prisma as any, proxyServerService as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        jest.spyOn(service as any, "buildTargets").mockResolvedValue([]);
        const persistJob = jest
            .spyOn(service as any, "persistJob")
            .mockRejectedValueOnce(new Error("database unavailable"))
            .mockResolvedValue(undefined);
        jest.spyOn(service as any, "execute").mockResolvedValue(undefined);

        await expect(service.createRun({} as any)).rejects.toThrow("database unavailable");
        await expect(service.createRun({} as any)).resolves.toMatchObject({ status: "queued" });
        expect(persistJob).toHaveBeenCalledTimes(3);
    });

    it("serializes progress snapshots so a stale write cannot overwrite newer run state", async () => {
        let finishFirstWrite!: () => void;
        const firstWrite = new Promise<void>((resolve) => {
            finishFirstWrite = resolve;
        });
        const upsert = jest.fn().mockReturnValueOnce(firstWrite).mockResolvedValue(undefined);
        const service = new ProxyTestService({ proxyTestRun: { upsert } } as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        const job = {
            id: "test-run",
            status: "queued",
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            target: "ALL",
            country: null,
            sizeMb: 1,
            samplesPerTariff: 1,
            concurrency: 2,
            gatewayHost: "gateway.example.test",
            results: [],
            error: "",
        };

        const queuedWrite = (service as any).persistJob(job);
        await Promise.resolve();
        await Promise.resolve();
        expect(upsert).toHaveBeenCalledTimes(1);
        job.status = "running";
        const runningWrite = (service as any).persistJob(job);
        await Promise.resolve();
        await Promise.resolve();
        expect(upsert).toHaveBeenCalledTimes(1);

        finishFirstWrite();
        await Promise.all([queuedWrite, runningWrite]);
        expect(upsert).toHaveBeenCalledTimes(2);
        expect(upsert.mock.calls.map(([call]) => call.update.status)).toEqual(["queued", "running"]);
    });
});
