import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { NotificationService } from "../notification/notification.service";
import { RentedIpProvider } from "./rented-ip.provider";
import { RentIpDto } from "./dtos/rent-ip.dto";

type RentedIpPricing = {
    ipv4: number; // цена за 1 IPv4 за период
    ipv6: number; // цена за 1 IPv6 за период
    periodDays: number; // длительность тарифного периода
    replaceLimit: number; // лимит замен IP (бан) на одну аренду
};

const DEFAULT_PRICING: RentedIpPricing = {
    ipv4: 3.0,
    ipv6: 1.0,
    periodDays: 30,
    replaceLimit: 3,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SPRINT-4 (ТЗ п.5) — аренда IPv4/IPv6 на время. Биллинг по IP×период (не по ГБ),
 * списание с основного баланса. Жизненный цикл: автопродление, уведомление за 3 дня,
 * выгрузка .txt, замена IP при бане с лимитом, истечение по крону.
 *
 * Реальное выделение IP — за {@link RentedIpProvider} (апстрим-реквизиты в ТЗ пока не заданы).
 */
@Injectable()
export class RentedIpService {
    private readonly logger = new Logger("RentedIp");

    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
        private readonly notifications: NotificationService,
        private readonly provider: RentedIpProvider,
    ) {}

    private async getPricing(): Promise<RentedIpPricing> {
        const stored = await this.settings.getValue<Partial<RentedIpPricing>>("rented_ip_pricing");
        return {
            ipv4: Number(stored?.ipv4) > 0 ? Number(stored!.ipv4) : DEFAULT_PRICING.ipv4,
            ipv6: Number(stored?.ipv6) > 0 ? Number(stored!.ipv6) : DEFAULT_PRICING.ipv6,
            periodDays: Number(stored?.periodDays) > 0 ? Number(stored!.periodDays) : DEFAULT_PRICING.periodDays,
            replaceLimit:
                Number(stored?.replaceLimit) >= 0 && stored?.replaceLimit !== undefined
                    ? Number(stored.replaceLimit)
                    : DEFAULT_PRICING.replaceLimit,
        };
    }

    private unitPrice(pricing: RentedIpPricing, family: "IPV4" | "IPV6"): number {
        return family === "IPV4" ? pricing.ipv4 : pricing.ipv6;
    }

    /** Стоимость аренды: цена за IP за период × кол-во × (срок / период). */
    private calcPrice(pricing: RentedIpPricing, family: "IPV4" | "IPV6", quantity: number, periodDays: number): number {
        const periods = periodDays / pricing.periodDays;
        return +(this.unitPrice(pricing, family) * quantity * periods).toFixed(2);
    }

    /** Арендовать IP (списание с баланса, выделение у апстрима, запись аренды). */
    async rent(userId: string, dto: RentIpDto) {
        const pricing = await this.getPricing();
        const periodDays = dto.periodDays ?? pricing.periodDays;
        const price = this.calcPrice(pricing, dto.family, dto.quantity, periodDays);

        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
        if (!user) throw new NotFoundException("errors.user_not_found");
        if (Number(user.balance) < price) {
            throw new BadRequestException("errors.insufficient_balance");
        }

        // Выделяем IP у апстрима ДО списания: если апстрим недоступен — баланс не трогаем.
        const allocated = await this.provider.allocate(dto.family, dto.quantity);

        try {
            const expiresAt = new Date(Date.now() + periodDays * DAY_MS);
            const created = await this.prisma.$transaction(async (tx) => {
                // Перепроверяем баланс внутри транзакции — защита от гонки параллельных аренд.
                const fresh = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
                if (!fresh || Number(fresh.balance) < price) {
                    throw new BadRequestException("errors.insufficient_balance");
                }
                await tx.user.update({
                    where: { id: userId },
                    data: { balance: { decrement: new Prisma.Decimal(price) } },
                });
                const rows = await Promise.all(
                    allocated.map((a) =>
                        tx.rentedIp.create({
                            data: {
                                userId,
                                family: dto.family,
                                ip: a.ip,
                                upstreamRef: a.upstreamRef,
                                expiresAt,
                                autoRenew: dto.autoRenew ?? false,
                            },
                        }),
                    ),
                );
                return rows;
            });
            this.logger.log(`user ${userId} rented ${created.length}×${dto.family} for ${periodDays}d (${price}$)`);
            return { items: created, charged: price, periodDays };
        } catch (e) {
            // Откатить выделение IP, если запись/списание не удались.
            await Promise.all(allocated.map((a) => this.provider.release(a.upstreamRef))).catch(() => {});
            throw e;
        }
    }

    /** Список аренд пользователя (по умолчанию активные). */
    listForUser(userId: string, includeInactive = false) {
        return this.prisma.rentedIp.findMany({
            where: { userId, ...(includeInactive ? {} : { status: "ACTIVE" }) },
            orderBy: { createdAt: "desc" },
        });
    }

    /** Выгрузка активных IP списком (для .txt). */
    async exportText(userId: string): Promise<string> {
        const rows = await this.prisma.rentedIp.findMany({
            where: { userId, status: "ACTIVE" },
            select: { ip: true },
            orderBy: { createdAt: "asc" },
        });
        return rows.map((r) => r.ip).join("\n");
    }

    /** Замена IP при бане (лимит из тарификации). Старый IP освобождается. */
    async replace(userId: string, rentedIpId: string) {
        const pricing = await this.getPricing();
        const row = await this.prisma.rentedIp.findUnique({ where: { id: rentedIpId } });
        if (!row || row.userId !== userId) throw new NotFoundException("errors.rented_ip_not_found");
        if (row.status !== "ACTIVE") throw new BadRequestException("errors.rented_ip_not_found");
        if (row.replaceCount >= pricing.replaceLimit) {
            throw new BadRequestException("errors.rented_ip_replace_limit");
        }

        const [fresh] = await this.provider.allocate(row.family as "IPV4" | "IPV6", 1);
        await this.provider.release(row.upstreamRef).catch(() => {});
        const updated = await this.prisma.rentedIp.update({
            where: { id: row.id },
            data: { ip: fresh.ip, upstreamRef: fresh.upstreamRef, replaceCount: { increment: 1 } },
        });
        this.logger.log(`user ${userId} replaced IP ${row.id} (#${updated.replaceCount}/${pricing.replaceLimit})`);
        return updated;
    }

    /** Включить/выключить автопродление. */
    async setAutoRenew(userId: string, rentedIpId: string, value: boolean) {
        const row = await this.prisma.rentedIp.findUnique({ where: { id: rentedIpId } });
        if (!row || row.userId !== userId) throw new NotFoundException("errors.rented_ip_not_found");
        return this.prisma.rentedIp.update({ where: { id: row.id }, data: { autoRenew: value } });
    }

    // --- Жизненный цикл (крон) ----------------------------------------------

    /** Уведомление за 3 дня до истечения (для аренд без автопродления). */
    @Cron(CronExpression.EVERY_6_HOURS)
    async notifyExpiringSoon() {
        const soon = new Date(Date.now() + 3 * DAY_MS);
        const due = await this.prisma.rentedIp.findMany({
            where: { status: "ACTIVE", autoRenew: false, notified3d: false, expiresAt: { lte: soon, gt: new Date() } },
        });
        for (const row of due) {
            try {
                await this.notifications.create({
                    userId: row.userId,
                    type: "rented_ip_expiring",
                    title: "Аренда IP скоро истекает",
                    body: `IP ${row.ip} (${row.family}) истекает ${row.expiresAt.toISOString().slice(0, 10)}. Продлите аренду, чтобы не потерять адрес.`,
                });
                await this.prisma.rentedIp.update({ where: { id: row.id }, data: { notified3d: true } });
            } catch (e) {
                this.logger.error(`notify expiring ${row.id} failed: ${e}`);
            }
        }
        if (due.length) this.logger.log(`notified ${due.length} expiring rentals`);
    }

    /** Истечение и автопродление аренд по сроку. */
    @Cron(CronExpression.EVERY_HOUR)
    async processExpirations() {
        const pricing = await this.getPricing();
        const expired = await this.prisma.rentedIp.findMany({
            where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
        });
        for (const row of expired) {
            try {
                if (row.autoRenew) {
                    const price = this.unitPrice(pricing, row.family as "IPV4" | "IPV6");
                    const renewed = await this.prisma.$transaction(async (tx) => {
                        // Баланс проверяем внутри транзакции — защита от гонки (как в rent()).
                        const fresh = await tx.user.findUnique({ where: { id: row.userId }, select: { balance: true } });
                        if (!fresh || Number(fresh.balance) < price) return false;
                        await tx.user.update({
                            where: { id: row.userId },
                            data: { balance: { decrement: new Prisma.Decimal(price) } },
                        });
                        await tx.rentedIp.update({
                            where: { id: row.id },
                            data: {
                                expiresAt: new Date(row.expiresAt.getTime() + pricing.periodDays * DAY_MS),
                                notified3d: false,
                            },
                        });
                        return true;
                    });
                    if (renewed) {
                        this.logger.log(`auto-renewed rental ${row.id} (${price}$)`);
                        continue;
                    }
                    // Недостаточно средств — истекает как обычная.
                }
                await this.provider.release(row.upstreamRef).catch(() => {});
                await this.prisma.rentedIp.update({ where: { id: row.id }, data: { status: "EXPIRED" } });
                await this.notifications
                    .create({
                        userId: row.userId,
                        type: "rented_ip_expired",
                        title: "Аренда IP истекла",
                        body: `IP ${row.ip} (${row.family}) больше не активен.`,
                    })
                    .catch(() => {});
            } catch (e) {
                this.logger.error(`expire ${row.id} failed: ${e}`);
            }
        }
        if (expired.length) this.logger.log(`processed ${expired.length} expired rentals`);
    }
}
