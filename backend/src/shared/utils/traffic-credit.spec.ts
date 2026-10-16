import { trafficCreditTotal } from "./traffic-credit";

describe("trafficCreditTotal", () => {
    it("uses credited total when it is the larger known value", () => {
        expect(trafficCreditTotal("1000", "0", "4000")).toBe(4000n);
    });

    it("never drops below remaining + recorded usage (legacy balances without history)", () => {
        expect(trafficCreditTotal("3000", "500", "1000")).toBe(3500n);
        expect(trafficCreditTotal("3000", "0", undefined)).toBe(3000n);
    });

    it("treats malformed values as zero", () => {
        expect(trafficCreditTotal("abc", "", "12")).toBe(12n);
    });
});
