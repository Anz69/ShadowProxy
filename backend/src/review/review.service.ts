import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { CreateReviewDto } from "./dtos/create-review.dto";

@Injectable()
export class ReviewService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) {}

    async create(userId: string, dto: CreateReviewDto) {
        const existing = await this.prisma.review.findUnique({ where: { userId } });
        if (existing) {
            throw new BadRequestException("errors.review_already_exists");
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { reviewDiscountGranted: true } as any,
        });
        const grantDiscount = !(user as any)?.reviewDiscountGranted;

        const review = await this.prisma.$transaction(async (tx) => {
            const created = await tx.review.create({
                data: { userId, rating: dto.rating, text: dto.text },
            });
            if (grantDiscount) {
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        reviewDiscountAvailable: true,
                        reviewDiscountGranted: true,
                    } as any,
                });
            }
            return created;
        });

        if (grantDiscount) {
            await this.notificationService.create({
                userId,
                type: "review_discount",
                title: "Скидка 30% за отзыв активна",
                body: "Спасибо за отзыв! Скидка 30% применится автоматически к следующей покупке любого пакета.",
                link: "/payment",
            });
        }

        return review;
    }

    async findOneByUser(userId: string) {
        return this.prisma.review.findUnique({ where: { userId } });
    }

    /** Был ли уже выдан discount за отзыв (остаётся true даже если отзыв удалён). */
    async wasReviewDiscountGranted(userId: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { reviewDiscountGranted: true } as any,
        });
        return !!(user as any)?.reviewDiscountGranted;
    }

    /** Была ли у юзера хотя бы одна оплаченная покупка (для баннера-просьбы об отзыве). */
    async hasPaidPurchase(userId: string): Promise<boolean> {
        const count = await this.prisma.payment.count({
            where: { userId, status: "PAID" },
        });
        return count > 0;
    }

    async adminList(params: { ratings?: number[]; sort?: "new" | "old"; q?: string; page?: number }) {
        const page = Math.max(1, params.page ?? 1);
        const limit = 10;
        const where: any = {};
        const validRatings = (params.ratings ?? []).filter((r) => r >= 1 && r <= 5);
        if (validRatings.length) where.rating = { in: validRatings };
        if (params.q) {
            where.OR = [
                { text: { contains: params.q, mode: "insensitive" } },
                { user: { email: { contains: params.q, mode: "insensitive" } } },
            ];
        }
        const [items, total] = await Promise.all([
            this.prisma.review.findMany({
                where,
                include: { user: { select: { email: true, tgLogin: true } } },
                orderBy: { createdAt: params.sort === "old" ? "asc" : "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.review.count({ where }),
        ]);
        return { items, total, page, limit };
    }

    async adminStats() {
        const all = await this.prisma.review.findMany({ select: { rating: true } });
        const total = all.length;
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
        for (const r of all) distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
        const avg = total ? all.reduce((s, r) => s + r.rating, 0) / total : 0;
        return { total, avg: Math.round(avg * 100) / 100, distribution };
    }

    async adminDelete(id: string) {
        await this.prisma.review.delete({ where: { id } });
        return { ok: true };
    }
}
