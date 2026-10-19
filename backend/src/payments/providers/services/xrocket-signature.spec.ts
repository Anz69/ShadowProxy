import { createHmac } from "crypto";
import { XRocketProvider } from "./xrocket.provider";

describe("XRocketProvider", () => {
    const config = {
        getOrThrow: (name: string) => (name === "NODE_ENV" ? "development" : "qa-xrocket-token"),
        get: (name: string) => (name === "XROCKET_WEBHOOK_SECRET" ? "qa-webhook-secret" : undefined),
    } as any;

    it("verifies Signature over `${timestamp}.${rawBody}` and rejects stale, malformed or forged ones", () => {
        const provider = new XRocketProvider(config, {} as any);
        const rawBody = Buffer.from('{"id":"wh1","type":"invoice","data":{"event":"invoice_status_changed","invoice":{"id":"inv1","status":"paid","clientInvoiceId":"p1"}}}');
        const now = 1_800_000_000_000;
        const ts = String(now - 1000);
        const valid = createHmac("sha256", "qa-webhook-secret").update(`${ts}.${rawBody.toString()}`).digest("hex");
        expect(provider.verifyWebhookSignature(rawBody, { signature: valid, version: "v1", timestamp: ts }, now)).toBe(true);
        // пересериализованное тело (другие пробелы) — подпись не совпадает
        expect(provider.verifyWebhookSignature(Buffer.from('{ "id": "wh1" }'), { signature: valid, version: "v1", timestamp: ts }, now)).toBe(false);
        for (const invalid of [undefined, "", "123", "x".repeat(64), "0".repeat(64)]) {
            expect(provider.verifyWebhookSignature(rawBody, { signature: invalid as any, version: "v1", timestamp: ts }, now)).toBe(false);
        }
        expect(provider.verifyWebhookSignature(rawBody, { signature: valid, version: "v2", timestamp: ts }, now)).toBe(false);
        expect(provider.verifyWebhookSignature(rawBody, { signature: valid, version: "v1", timestamp: String(now - 600_000) }, now)).toBe(false);
        expect(provider.verifyWebhookSignature(undefined, { signature: valid, version: "v1", timestamp: ts }, now)).toBe(false);
    });

    it("refuses webhooks when no webhook secret is configured", () => {
        const provider = new XRocketProvider({ ...config, get: () => undefined } as any, {} as any);
        expect(provider.verifyWebhookSignature(Buffer.from("{}"), { signature: "0".repeat(64), version: "v1", timestamp: String(Date.now()) })).toBe(false);
    });

    it("maps our assets to xRocket currencies and refuses unsupported ones", () => {
        expect(XRocketProvider.supportsAsset("USDT")).toBe(true);
        expect(XRocketProvider.supportsAsset("LTC")).toBe(false);
        expect(XRocketProvider.supportsAsset("TON")).toBe(false);
    });
});
