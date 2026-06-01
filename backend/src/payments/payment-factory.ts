import { v4 } from "uuid";
import { PaymentProvider, Prisma } from "@prisma/client";
import { AvailableAssets } from "./types/available-assets.type";

export class PaymentFactory {
    private amount: number;
    private amountUsd: number;

    private asset: AvailableAssets;
    private provider: PaymentProvider;
    private contents: any[];
    private userId: string;
    private discount?: { kind: "trial" | "review"; pct: number; originalUsd: number };

    static create() {
        return new PaymentFactory();
    }

    withAmount(amount: number) {
        this.amount = amount;
        return this;
    }

    withAmountUsd(amountUsd: number) {
        this.amountUsd = amountUsd;
        return this;
    }

    withAsset(asset: AvailableAssets) {
        this.asset = asset;
        return this;
    }

    withProvider(provider: PaymentProvider) {
        this.provider = provider;
        return this;
    }

    withContents(contents: any[]) {
        this.contents = contents;
        return this;
    }

    forUser(userId: string) {
        this.userId = userId;
        return this;
    }

    withDiscount(discount?: { kind: "trial" | "review"; pct: number; originalUsd: number }) {
        this.discount = discount;
        return this;
    }

    build(): Prisma.PaymentCreateInput {
        return {
            id: v4(),
            amount: this.amount,
            amountUsd: this.amountUsd,
            asset: this.asset,
            provider: this.provider,
            metadata: {
                contents: this.contents,
                ...(this.discount ? { discount: this.discount } : {}),
            },
            user: {
                connect: { id: this.userId },
            },
            createdAt: new Date(),
        };
    }
}
