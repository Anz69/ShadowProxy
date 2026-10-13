import { validateSync } from "class-validator";
import { GetTrialDto } from "./get-trial.dto";

describe("GetTrialDto", () => {
    it.each(["ISP_USA", "RESIDENTIAL_LITE", "RESIDENT_PREMIUM"])("accepts supported trial tariff %s", (tariffType) => {
        expect(validateSync(Object.assign(new GetTrialDto(), { tariffType }))).toHaveLength(0);
    });

    it.each(["ISP_EU", "IPV6_GB", "MOBILE_GB", "MOBILE"])("rejects unavailable trial tariff %s", (tariffType) => {
        expect(validateSync(Object.assign(new GetTrialDto(), { tariffType })).length).toBeGreaterThan(0);
    });
});
