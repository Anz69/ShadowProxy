import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SupportAuthor, SupportTicketStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { MailingService } from "../mailing/mailing.service";
import { LoggerService } from "../logger/logger.service";
import { SupportAttachment } from "./support-upload";

/**
 * Система поддержки (ТЗ п.1-2): один диалог (тикет) на пользователя.
 * Реалтайм — polling с фронта (паттерн проекта: react-query refetchInterval;
 * наружу по TLS открыт только HTTP-стек, ws-канала для браузера нет).
 */
@Injectable()
export class SupportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly mailingService: MailingService,
        private readonly logger: LoggerService,
    ) {}

    // ── Клиентская часть ─────────────────────────────────────────────────────

    /** Диалог юзера: тикет + сообщения (опциональный `after` — только новые, для polling). */
    async getThreadForUser(userId: string, after?: string) {
        const ticket = await this.prisma.supportTicket.findUnique({ where: { userId } });
        if (!ticket) return { ticket: null, messages: [] };

        const afterDate = after ? new Date(after) : null;
        const messages = await this.prisma.supportMessage.findMany({
            where: {
                ticketId: ticket.id,
                ...(afterDate && !isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}),
            },
            orderBy: { createdAt: "asc" },
            take: 500,
        });
        return { ticket, messages };
    }

    /** Сообщение от юзера (создаёт тикет при первом обращении). */
    async sendUserMessage(userId: string, text: string, attachments: SupportAttachment[]) {
        const trimmed = (text || "").trim();
        if (!trimmed && attachments.length === 0) {
            throw new BadRequestException("errors.support_empty_message");
        }

        const ticket = await this.prisma.supportTicket.upsert({
            where: { userId },
            create: { userId },
            update: {},
        });

        const message = await this.prisma.supportMessage.create({
            data: {
                ticketId: ticket.id,
                authorRole: SupportAuthor.USER,
                text: trimmed,
                attachments: attachments as unknown as object[],
            },
        });

        // Новое сообщение юзера: закрытый/отвеченный диалог снова «ожидает ответа».
        await this.prisma.supportTicket.update({
            where: { id: ticket.id },
            data: {
                lastMessageAt: message.createdAt,
                status:
                    ticket.status === SupportTicketStatus.IN_PROGRESS
                        ? SupportTicketStatus.IN_PROGRESS
                        : SupportTicketStatus.NEW,
            },
        });

        return message;
    }

    /** Юзер открыл чат — отметить сообщения поддержки прочитанными. */
    async markReadByUser(userId: string) {
        const ticket = await this.prisma.supportTicket.findUnique({ where: { userId } });
        if (!ticket) return { updated: 0 };
        const res = await this.prisma.supportMessage.updateMany({
            where: { ticketId: ticket.id, authorRole: SupportAuthor.ADMIN, readAt: null },
            data: { readAt: new Date() },
        });
        return { updated: res.count };
    }

    /** Непрочитанные юзером ответы поддержки (для бейджа). */
    async unreadCountForUser(userId: string) {
        const ticket = await this.prisma.supportTicket.findUnique({ where: { userId } });
        if (!ticket) return { count: 0 };
        const count = await this.prisma.supportMessage.count({
            where: { ticketId: ticket.id, authorRole: SupportAuthor.ADMIN, readAt: null },
        });
        return { count };
    }

    // ── Админ-часть (ТЗ п.2) ─────────────────────────────────────────────────

    async listTicketsForAdmin(params: { page: number; limit: number; status?: SupportTicketStatus; search?: string }) {
        const { page, limit, status } = params;
        const search = params.search?.trim();

        const where = {
            ...(status ? { status } : {}),
            ...(search
                ? {
                      OR: [
                          { userId: search },
                          { user: { email: { contains: search, mode: "insensitive" as const } } },
                          { user: { tgLogin: { contains: search, mode: "insensitive" as const } } },
                      ],
                  }
                : {}),
        };

        const [total, tickets] = await Promise.all([
            this.prisma.supportTicket.count({ where }),
            this.prisma.supportTicket.findMany({
                where,
                orderBy: { lastMessageAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: { id: true, email: true, tgLogin: true } },
                    messages: { orderBy: { createdAt: "desc" }, take: 1, select: { text: true, authorRole: true, attachments: true, createdAt: true } },
                    _count: {
                        select: {
                            messages: { where: { authorRole: SupportAuthor.USER, readAt: null } },
                        },
                    },
                },
            }),
        ]);

        return {
            total,
            page,
            limit,
            tickets: tickets.map((t) => ({
                id: t.id,
                status: t.status,
                lastMessageAt: t.lastMessageAt,
                createdAt: t.createdAt,
                user: t.user,
                lastMessage: t.messages[0] ?? null,
                unreadFromUser: t._count.messages,
            })),
        };
    }

    /** Диалог для админа: тикет + сообщения + данные юзера для сайдбара быстрых действий. */
    async getTicketForAdmin(ticketId: string) {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        tgLogin: true,
                        authMethod: true,
                        balance: true,
                        createdAt: true,
                        premiumTrafficLeft: true,
                        premiumResidentialTrafficLeft: true,
                        mobileGbTrafficLeft: true,
                        mobileTrafficLeft: true,
                        ipv6GbTrafficLeft: true,
                        ispUsaTrafficLeft: true,
                        ispEuTrafficLeft: true,
                        residentialLiteTrafficLeft: true,
                    },
                },
            },
        });
        if (!ticket) throw new NotFoundException("errors.support_ticket_not_found");

        const messages = await this.prisma.supportMessage.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
            take: 500,
        });
        return { ticket, messages };
    }

    /** Ответ поддержки: сообщение + статус ANSWERED + уведомление юзеру (центр + best-effort email). */
    async sendAdminMessage(ticketId: string, text: string, attachments: SupportAttachment[]) {
        const trimmed = (text || "").trim();
        if (!trimmed && attachments.length === 0) {
            throw new BadRequestException("errors.support_empty_message");
        }

        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: { user: { select: { id: true, email: true } } },
        });
        if (!ticket) throw new NotFoundException("errors.support_ticket_not_found");

        const message = await this.prisma.supportMessage.create({
            data: {
                ticketId,
                authorRole: SupportAuthor.ADMIN,
                text: trimmed,
                attachments: attachments as unknown as object[],
            },
        });

        await this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { lastMessageAt: message.createdAt, status: SupportTicketStatus.ANSWERED },
        });

        // Уведомление в центре сайта (ТЗ 1.4). Email — best-effort, не блокирует ответ.
        try {
            await this.notificationService.create({
                userId: ticket.user.id,
                type: "support_reply",
                title: "Поддержка ответила",
                body: "На ваше обращение поступил ответ. Откройте чат поддержки, чтобы прочитать.",
                link: "/support",
            });
        } catch (e) {
            await this.logger.error(`support: не удалось создать уведомление для ${ticket.user.id}: ${e}`);
        }
        void this.mailingService
            .sendMail(
                ticket.user.email,
                "Ответ поддержки ShadowProxy",
                `<p>На ваше обращение в поддержку поступил ответ.</p><p><a href="${process.env.HOST || "https://shadowproxy.io"}/support">Открыть чат поддержки</a></p>`,
            )
            .catch(() => {});

        return message;
    }

    async setTicketStatus(ticketId: string, status: SupportTicketStatus) {
        const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new NotFoundException("errors.support_ticket_not_found");
        return this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
    }

    /** Админ открыл диалог — отметить сообщения юзера прочитанными. */
    async markReadByAdmin(ticketId: string) {
        const res = await this.prisma.supportMessage.updateMany({
            where: { ticketId, authorRole: SupportAuthor.USER, readAt: null },
            data: { readAt: new Date() },
        });
        return { updated: res.count };
    }

    /** Сколько тикетов с непрочитанными сообщениями юзеров (бейдж в AdminNav). */
    async unreadCountForAdmin() {
        const count = await this.prisma.supportTicket.count({
            where: { messages: { some: { authorRole: SupportAuthor.USER, readAt: null } } },
        });
        return { count };
    }
}
