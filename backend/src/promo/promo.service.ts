import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PromoCodeMode } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoggerService } from "../logger/logger.service";
import { CreatePromoDto } from "./dtos/create-promo.dto";

@Injectable()
export class PromoService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService,
    ) {}

    private normalize(code: string) {
        return code.trim().toUpperCase();
    }

    private generateCode() {
        return `SHADOW-${randomBytes(5).toString("hex").toUpperCase()}`;
    }

    async activate(rawCode: string, userId: string) {
        const code = this.normalize(rawCode);
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const promo = await tx.promoCode.findUnique({ where: { code } });
                if (!promo) throw new NotFoundException("Промокод не найден");
                if (!promo.active) throw new BadRequestException("Промокод уже использован или отключён");
                if (promo.expiresAt.getTime() <= Date.now()) throw new BadRequestException("Срок действия промокода истёк");

                const duplicate = await tx.promoRedemption.findUnique({
                    where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
                });
                if (duplicate) throw new ConflictException("Вы уже активировали этот промокод");

                const claimed = await tx.promoCode.updateMany({
                    where: {
                        id: promo.id,
                        active: true,
                        expiresAt: { gt: new Date() },
                        ...(promo.mode === PromoCodeMode.ONE_TIME ? { activationCount: 0 } : {}),
                    },
                    data: {
                        activationCount: { increment: 1 },
                        ...(promo.mode === PromoCodeMode.ONE_TIME ? { active: false } : {}),
                    },
                });
                if (claimed.count !== 1) throw new ConflictException("Промокод уже использован или отключён");

                await tx.promoRedemption.create({
                    data: { promoCodeId: promo.id, userId, amount: promo.amount },
                });
                const user = await tx.user.update({
                    where: { id: userId },
                    data: { balance: { increment: promo.amount } },
                    select: { balance: true },
                });
                return { amount: Number(promo.amount), balance: Number(user.balance), code: promo.code };
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

            await this.logger.log("REPLENISH", `Промокод ${result.code} активирован на ${result.amount}$`, userId, {
                source: "promo_code",
                code: result.code,
                amount: result.amount,
            }).catch(() => undefined);
            return result;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
                throw new ConflictException("Вы уже активировали этот промокод");
            }
            throw error;
        }
    }

    async create(dto: CreatePromoDto, adminId: string) {
        const code = dto.code ? this.normalize(dto.code) : this.generateCode();
        const expiresAt = new Date(dto.expiresAt);
        if (expiresAt.getTime() <= Date.now()) throw new BadRequestException("Срок действия должен быть в будущем");
        try {
            const promo = await this.prisma.promoCode.create({
                data: { code, amount: dto.amount, expiresAt, mode: dto.mode },
            });
            await this.logger.log("SYSTEM", `Админ создал промокод ${code}`, adminId, { promoCodeId: promo.id }).catch(() => undefined);
            return promo;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new ConflictException("Такой промокод уже существует");
            }
            throw error;
        }
    }

    async list() {
        return this.prisma.promoCode.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                redemptions: {
                    orderBy: { createdAt: "desc" },
                    select: { id: true, amount: true, createdAt: true, user: { select: { id: true, email: true, tgLogin: true } } },
                },
            },
        });
    }

    async deactivate(id: string, adminId: string) {
        const promo = await this.prisma.promoCode.findUnique({ where: { id } });
        if (!promo) throw new NotFoundException("Промокод не найден");
        const updated = await this.prisma.promoCode.update({ where: { id }, data: { active: false } });
        await this.logger.log("SYSTEM", `Админ отключил промокод ${promo.code}`, adminId, { promoCodeId: id }).catch(() => undefined);
        return updated;
    }

    async remove(id: string, adminId: string) {
        const promo = await this.prisma.promoCode.findUnique({ where: { id } });
        if (!promo) throw new NotFoundException("Промокод не найден");
        await this.prisma.promoCode.delete({ where: { id } });
        await this.logger.log("SYSTEM", `Админ удалил промокод ${promo.code}`, adminId, { promoCodeId: id }).catch(() => undefined);
        return { success: true };
    }
}
