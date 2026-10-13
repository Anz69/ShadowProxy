import { ValidationArguments } from "class-validator";
import { IsTariffExistsConstraint } from "./is-tariff-exists-constraint";

describe("Unavailable tariff validation", () => {
    const validator = new IsTariffExistsConstraint();
    const args = {} as ValidationArguments;

    it.each(["ISP_USA", "isp_usa", "RESIDENTIAL_LITE", "RESIDENT_PREMIUM", "resident_premium", "PREMIUM_RESIDENTIAL", "MOBILE"])(
        "allows available tariff %s", value => {
            expect(validator.validate(value, args)).toBe(true);
        },
    );

    it.each(["ISP_EU", "isp_eu", null, undefined, 123, {}])(
        "rejects unavailable or malformed tariff %s", value => {
            expect(validator.validate(value, args)).toBe(false);
        },
    );
});
