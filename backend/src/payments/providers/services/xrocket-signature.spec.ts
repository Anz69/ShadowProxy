import { createHash, createHmac } from "crypto";
import { XRocketProvider } from "./xrocket.provider";

describe("XRocketProvider", () => {
    const config = {
        getOrThrow: (name: string) => (name === "NODE_ENV" ? "development" : "qa-xrocket-token"),
        get: () => undefined,
    } as any;

    it("checks rocket-pay-signature HMAC and rejects missing/truncated/forged signatures", () => {
        const provider = new XRocketProvider(config, {} as any);
        const body = { type: "invoicePay", timestamp: "2026-10-17T00:00:00Z", data: { id: 1, status: "paid", payload: "{\"paymentId\":\"p1\"}" } } as any;
        const key = createHash("sha256").update("qa-xrocket-token").digest();
        const valid = createHmac("sha256", key).update(JSON.stringify(body)).digest("hex");
        expect(provider.verifyWebhookSignature(body, valid)).toBe(true);
        for (const invalid of [undefined, "", "123", "x".repeat(64), "0".repeat(64)]) {
            expect(provider.verifyWebhookSignature(body, invalid as any)).toBe(false);
        }
    });

    it("maps our assets to xRocket currencies and refuses unsupported ones", () => {
        expect(XRocketProvider.CURRENCY_BY_ASSET.TON).toBe("TONCOIN");
        expect(XRocketProvider.supportsAsset("USDT")).toBe(true);
        expect(XRocketProvider.supportsAsset("LTC")).toBe(false);
    });
});
