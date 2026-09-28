import axios from "axios";
import { ProxyTestService } from "./proxy-test.service";

describe("ProxyTestService gateway accounting checks", () => {
    it("waits for CORE acknowledgement, not only live gateway counters", async () => {
        const service = new ProxyTestService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        const getSpy = jest
            .spyOn(axios, "get")
            .mockResolvedValueOnce({ data: { in_bytes: 1_000_000, out_bytes: 0, reported_in_bytes: 0, reported_out_bytes: 0 } } as any)
            .mockResolvedValueOnce({ data: { in_bytes: 1_000_000, out_bytes: 0, reported_in_bytes: 1_000_000, reported_out_bytes: 0 } } as any);

        const stats = await (service as any).waitForGatewayStats("gateway", "token", "qa-login", 1_000_000);

        expect(getSpy).toHaveBeenCalledTimes(2);
        expect(stats.reportedInBytes).toBe(1_000_000);
        getSpy.mockRestore();
    });
});
