import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type NotificationType =
    | "review_request"
    | "review_discount"
    | "trial_link_required"
    | "trial_discount";

@Injectable()
export class NotificationService {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: { userId: string; type: NotificationType; title: string; body: string; link?: string }) {
        return this.prisma.notification.create({
            data: {
                userId: data.userId,
                type: data.type,
                title: data.title,
                body: data.body,
                link: data.link ?? null,
            },
        });
    }

    /** Не создавать дубль уведомления того же типа у пользователя (idempotent). */
    async createOnce(data: { userId: string; type: NotificationType; title: string; body: string; link?: string }) {
        const existing = await this.prisma.notification.findFirst({
            where: { userId: data.userId, type: data.type },
        });
        if (existing) return existing;
        return this.create(data);
    }

    async listForUser(userId: string, page = 1, limit = 30) {
        const skip = (Math.max(1, page) - 1) * limit;
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        });
    }

    async unreadCount(userId: string) {
        return this.prisma.notification.count({
            where: { userId, readAt: null },
        });
    }

    async markRead(id: string, userId: string) {
        const n = await this.prisma.notification.findUnique({ where: { id } });
        if (!n || n.userId !== userId) return null;
        return this.prisma.notification.update({
            where: { id },
            data: { readAt: new Date() },
        });
    }

    async markAllRead(userId: string) {
        const res = await this.prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });
        return { count: res.count };
    }
}
