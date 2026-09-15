import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PromoCodeMode } from "@prisma/client";
import { PromoService } from "./promo.service";

describe("PromoService", () => {
    const logger = { log: jest.fn().mockResolvedValue(undefined) };

    function serviceWith(promo: any, options: { duplicate?: boolean; claimed?: number } = {}) {
        const tx = {
            promoCode: {
                findUnique: jest.fn().mockResolvedValue(promo),
                updateMany: jest.fn().mockResolvedValue({ count: options.claimed ?? 1 }),
            },
            promoRedemption: {
                findUnique: jest.fn().mockResolvedValue(options.duplicate ? { id: "used" } : null),
                create: jest.fn().mockResolvedValue({ id: "redemption" }),
            },
            user: { update: jest.fn().mockResolvedValue({ balance: 25 }) },
        };
        const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) };
        return { service: new PromoService(prisma as any, logger as any), tx };
    }

    it("атомарно активирует многоразовый код и пополняет баланс", async () => {
        const promo = { id: "promo", code: "SHADOW10", amount: 10, active: true, activationCount: 0, mode: PromoCodeMode.MULTI_USE, expiresAt: new Date(Date.now() + 60_000) };
        const { service, tx } = serviceWith(promo);

        await expect(service.activate(" shadow10 ", "user")).resolves.toEqual({ amount: 10, balance: 25, code: "SHADOW10" });
        expect(tx.promoCode.findUnique).toHaveBeenCalledWith({ where: { code: "SHADOW10" } });
        expect(tx.promoRedemption.create).toHaveBeenCalledTimes(1);
        expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user" } }));
    });

    it("не позволяет одному пользователю применить код повторно", async () => {
        const promo = { id: "promo", code: "ONCE", amount: 10, active: true, activationCount: 0, mode: PromoCodeMode.MULTI_USE, expiresAt: new Date(Date.now() + 60_000) };
        const { service } = serviceWith(promo, { duplicate: true });
        await expect(service.activate("ONCE", "user")).rejects.toBeInstanceOf(ConflictException);
    });

    it("отклоняет отсутствующий и истёкший код", async () => {
        const missing = serviceWith(null).service;
        await expect(missing.activate("NOPE", "user")).rejects.toBeInstanceOf(NotFoundException);

        const expired = serviceWith({ id: "promo", code: "OLD", amount: 1, active: true, mode: PromoCodeMode.MULTI_USE, expiresAt: new Date(Date.now() - 1) }).service;
        await expect(expired.activate("OLD", "user")).rejects.toBeInstanceOf(BadRequestException);
    });
});
