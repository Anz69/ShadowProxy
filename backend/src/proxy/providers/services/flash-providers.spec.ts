import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IspEuProvider } from "./isp-eu.provider";
import { IspUsaProvider } from "./isp-usa.provider";
import { ResidentialLiteProvider } from "./residential-lite.provider";

const values: Record<string, string> = {
    FLASH_ISP_EU_USERNAME: "eu-user",
    FLASH_ISP_EU_PASSWORD: "eu-pass",
    FLASH_ISP_USA_USERNAME: "us-user",
    FLASH_ISP_USA_PASSWORD: "us-pass",
    FLASH_RESIDENTIAL_LITE_USERNAME: "lite-user",
    FLASH_RESIDENTIAL_LITE_PASSWORD: "lite-pass",
};

const config = {
    get: jest.fn((key: string, fallback: string) => values[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => {
        if (!values[key]) throw new Error(`missing ${key}`);
        return values[key];
    }),
} as unknown as ConfigService;

describe("Flash proxy providers", () => {
    it("ISP EU accepts only NL and builds timed rotation", () => {
        const provider = new IspEuProvider(config);
        expect(provider.getCountries()).toEqual(["NL"]);
        expect(provider.createProxy("nl")).toEqual({
            host: "eu-isp.flashproxy.io",
            port: 30,
            username: "eu-user-country-NL",
            password: "eu-pass",
        });
        expect(provider.createProxy("NL", 1440).username).toMatch(/^eu-user-country-NL-time-1440-session-[A-Za-z0-9]{8}$/);
        expect(() => provider.createProxy("DE")).toThrow(BadRequestException);
        expect(() => provider.createProxy("NL", 1441)).toThrow(BadRequestException);
    });

    it("ISP USA always uses US and validates rotation", () => {
        const provider = new IspUsaProvider(config);
        expect(provider.createProxy()).toEqual({
            host: "beta.flashproxy.io",
            port: 30,
            username: "us-user-country-US",
            password: "us-pass",
        });
        expect(provider.createProxy(1).username).toMatch(/^us-user-country-US-time-1-session-[A-Za-z0-9]{8}$/);
        expect(() => provider.createProxy(0)).toThrow(BadRequestException);
    });

    it("Residential Lite accepts ISO-2 countries and validates rotation", () => {
        const provider = new ResidentialLiteProvider(config);
        expect(provider.createProxy("es")).toEqual({
            host: "lite.flashproxy.io",
            port: 6969,
            username: "lite-user-country-ES",
            password: "lite-pass",
        });
        expect(() => provider.createProxy("ESP")).toThrow(BadRequestException);
        expect(() => provider.createProxy("ES", 1441)).toThrow(BadRequestException);
    });
});
