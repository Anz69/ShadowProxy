import { reconcileProxyEmpireUsage } from "./proxy-empire-usage";

describe("reconcileProxyEmpireUsage", () => {
    it("shows zero after an exhausted first 100 MB even without a prior snapshot", () => {
        expect(reconcileProxyEmpireUsage("104857600", "0", { total: 104857600, used: 104857600, remaining: 0 })).toEqual({
            left: "0", snapshot: "104857600", charged: 104857600n, mismatch: false,
        });
    });

    it("does not charge traffic already reflected in the local balance", () => {
        expect(reconcileProxyEmpireUsage("52428800", "0", { total: 104857600, used: 52428800, remaining: 52428800 }).charged).toBe(0n);
    });

    it("handles provider usage slightly above a fully exhausted quota", () => {
        expect(reconcileProxyEmpireUsage("214748364", "0", { total: 214748365, used: 214755507, remaining: 0 }).left).toBe("0");
    });

    it("charges only new usage after a snapshot", () => {
        expect(reconcileProxyEmpireUsage("94371840", "10485760", { total: 104857600, used: 20971520, remaining: 83886080 })).toEqual({
            left: "83886080", snapshot: "20971520", charged: 10485760n, mismatch: false,
        });
    });

    it("does not erase a local balance when the provider quota is not provisioned", () => {
        expect(reconcileProxyEmpireUsage("1073741824", "0", { total: 1, used: 0, remaining: 1 })).toEqual({
            left: "1073741824", snapshot: "0", charged: 0n, mismatch: true,
        });
        expect(reconcileProxyEmpireUsage("6892256511", "624081389", { total: 6442450944, used: 4535041607, remaining: 1907409337 }).charged).toBe(0n);
    });

    it("rejects malformed provider counters", () => {
        expect(() => reconcileProxyEmpireUsage("100", "0", { total: 100, used: Number.NaN, remaining: 0 })).toThrow();
        expect(() => reconcileProxyEmpireUsage("10485760", "0", { total: 10485760, used: 0, remaining: 0 })).toThrow();
    });
});
