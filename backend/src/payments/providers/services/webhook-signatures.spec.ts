import { createHash, createHmac } from "crypto";
import { CryptoBotProvider } from "./crypto-bot.provider";
import { HeleketProvider } from "./heleket.provider";

describe("Webhook authentication rejects malformed signatures without a 500", () => {
    const config = { getOrThrow: (name: string) => name === "NODE_ENV" ? "development" : "qa-secret" } as any;
    it("checks CryptoBot HMAC and rejects missing/truncated/forged signatures", () => {
        const provider = new CryptoBotProvider(config, {} as any);
        const body = { update_id: 1, update_type: "invoice_paid", payload: { status: "paid" } } as any;
        const key = createHash("sha256").update("qa-secret").digest();
        const valid = createHmac("sha256", key).update(JSON.stringify(body)).digest("hex");
        expect(provider.verifyWebhookSignature(body, valid)).toBe(true);
        for (const invalid of [undefined, "", "123", "x".repeat(64), "0".repeat(64)]) {
            expect(provider.verifyWebhookSignature(body, invalid as any)).toBe(false);
        }
    });
    it("checks Heleket signature and rejects missing/truncated/forged signatures", () => {
        const provider = new HeleketProvider(config);
        const body = { order_id: "qa-id", status: "paid" };
        const valid = provider.signBody(body);
        expect(provider.verifyWebhookSignature({ ...body, sign: valid } as any)).toBe(true);
        for (const sign of [undefined, "", "123", "x".repeat(32), "0".repeat(32)]) {
            expect(provider.verifyWebhookSignature({ ...body, sign } as any)).toBe(false);
        }
    });
});
