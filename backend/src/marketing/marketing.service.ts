import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoggerService } from "../logger/logger.service";
import { AddExpenseDto, AddNoteDto, CampaignStatsQueryDto, CreateCampaignDto, UpdateCampaignDto } from "./dtos/campaign.dto";

/** Реальные деньги клиента. BALANCE/REFERRAL_BALANCE — трата уже пополненного баланса, промокоды платежей не создают. */
const PAID_PROVIDERS = ["CRYPTO_BOT", "HELEKET", "XROCKET"];
const UTM_MEDIUM = "paid";
const DAY_MS = 86_400_000;
/** Дольше — точки графика по неделям, иначе линия превращается в шум. */
const MAX_DAILY_POINTS = 120;

const SOURCE_UTM: Record<string, string> = {
    "Telegram Ads": "telegram",
    "Telegram-каналы": "telegram_channels",
    "Google Ads": "google",
    "Яндекс Директ": "yandex",
    "Facebook / Instagram": "meta",
    TikTok: "tiktok",
    YouTube: "youtube",
    "VK Реклама": "vk",
    "Блогеры": "influencers",
    "Форумы": "forums",
};

const TRANSLIT: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
    р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

type Totals = {
    registrations: number;
    trials: number;
    payers: number;
    payments: number;
    revenue: number;
    referrals: number;
    spend: number;
};

type Bucket = "day" | "week";

@Injectable()
export class MarketingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService,
        private readonly config: ConfigService,
    ) {}

    // ──────────────── Кампании ────────────────

    async list() {
        const campaigns = await this.prisma.marketingCampaign.findMany({ orderBy: { createdAt: "desc" } });
        if (campaigns.length === 0) return [];

        const [users, payments, referrals, expenses] = await Promise.all([
            this.prisma.$queryRaw<Array<{ cid: string; registrations: number; trials: number }>>`
                SELECT utm_campaign_id AS cid, COUNT(*)::int AS registrations, COUNT(trial)::int AS trials
                FROM users
                WHERE utm_campaign_id IS NOT NULL
                GROUP BY 1`,
            this.prisma.$queryRaw<Array<{ cid: string; payers: number; payments: number; revenue: number }>>`
                SELECT u.utm_campaign_id AS cid,
                       COUNT(DISTINCT p.user_id)::int AS payers,
                       COUNT(*)::int AS payments,
                       COALESCE(SUM(p."amountUsd"), 0)::float8 AS revenue
                FROM payments p
                JOIN users u ON u.id = p.user_id
                WHERE u.utm_campaign_id IS NOT NULL
                  AND p.status = 'PAID'
                  AND p.provider::text = ANY(${PAID_PROVIDERS})
                GROUP BY 1`,
            this.prisma.$queryRaw<Array<{ cid: string; referrals: number }>>`
                SELECT u.utm_campaign_id AS cid, COUNT(*)::int AS referrals
                FROM users r
                JOIN users u ON u.id = r.referrer_id
                WHERE u.utm_campaign_id IS NOT NULL
                GROUP BY 1`,
            this.prisma.marketingCampaignExpense.groupBy({ by: ["campaignId"], _sum: { amount: true } }),
        ]);

        const byId = <T extends { cid: string }>(rows: T[]) => new Map(rows.map((r) => [r.cid, r]));
        const u = byId(users);
        const p = byId(payments);
        const r = byId(referrals);
        const e = new Map(expenses.map((x) => [x.campaignId, Number(x._sum.amount ?? 0)]));

        return campaigns.map((c) =>
            this.present(c, {
                registrations: u.get(c.id)?.registrations ?? 0,
                trials: u.get(c.id)?.trials ?? 0,
                payers: p.get(c.id)?.payers ?? 0,
                payments: p.get(c.id)?.payments ?? 0,
                revenue: Number(p.get(c.id)?.revenue ?? 0),
                referrals: r.get(c.id)?.referrals ?? 0,
                spend: e.get(c.id) ?? 0,
            }),
        );
    }

    async create(dto: CreateCampaignDto, adminId: string) {
        const base = this.slugify(dto.name) || "campaign";
        for (let attempt = 0; attempt < 5; attempt++) {
            const slug = `${base}-${randomBytes(3).toString("hex")}`;
            try {
                const campaign = await this.prisma.marketingCampaign.create({
                    data: {
                        name: dto.name,
                        source: dto.source,
                        utmSource: this.utmSourceOf(dto.source),
                        slug,
                        ...(dto.note ? { notes: { create: { text: dto.note } } } : {}),
                    },
                });
                await this.logger.log("SYSTEM", `Админ создал рекламную кампанию «${campaign.name}» (${slug})`, adminId, { campaignId: campaign.id }).catch(() => undefined);
                return this.present(campaign, this.emptyTotals());
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
                throw error;
            }
        }
        throw new ConflictException("Не удалось сгенерировать уникальную UTM-метку, попробуйте ещё раз");
    }

    async update(id: string, dto: UpdateCampaignDto, adminId: string) {
        await this.findOrThrow(id);
        const campaign = await this.prisma.marketingCampaign.update({
            where: { id },
            data: {
                ...(dto.name ? { name: dto.name } : {}),
                ...(dto.source ? { source: dto.source, utmSource: this.utmSourceOf(dto.source) } : {}),
            },
        });
        await this.logger.log("SYSTEM", `Админ изменил рекламную кампанию «${campaign.name}»`, adminId, { campaignId: id, ...dto }).catch(() => undefined);
        return campaign;
    }

    async addExpense(id: string, dto: AddExpenseDto, adminId: string) {
        const campaign = await this.findOrThrow(id);
        const spentAt = dto.spentAt ? new Date(dto.spentAt) : new Date();
        if (spentAt.getTime() > Date.now() + DAY_MS) throw new BadRequestException("Дата расхода не может быть в будущем");
        const expense = await this.prisma.marketingCampaignExpense.create({
            data: { campaignId: id, amount: new Prisma.Decimal(dto.amount), spentAt, comment: dto.comment || null },
        });
        await this.logger.log("SYSTEM", `Админ добавил расход ${dto.amount}$ в кампанию «${campaign.name}»`, adminId, { campaignId: id, expenseId: expense.id, amount: dto.amount }).catch(() => undefined);
        return expense;
    }

    async removeExpense(id: string, expenseId: string, adminId: string) {
        const expense = await this.prisma.marketingCampaignExpense.findFirst({ where: { id: expenseId, campaignId: id } });
        if (!expense) throw new NotFoundException("Расход не найден");
        await this.prisma.marketingCampaignExpense.delete({ where: { id: expenseId } });
        await this.logger.log("SYSTEM", `Админ удалил расход ${Number(expense.amount)}$ из кампании ${id}`, adminId, { campaignId: id, expenseId }).catch(() => undefined);
        return { success: true };
    }

    async addNote(id: string, dto: AddNoteDto, adminId: string) {
        await this.findOrThrow(id);
        const note = await this.prisma.marketingCampaignNote.create({ data: { campaignId: id, text: dto.text } });
        await this.logger.log("SYSTEM", `Админ добавил примечание к кампании ${id}`, adminId, { campaignId: id, noteId: note.id }).catch(() => undefined);
        return note;
    }

    async removeNote(id: string, noteId: string, adminId: string) {
        const note = await this.prisma.marketingCampaignNote.findFirst({ where: { id: noteId, campaignId: id } });
        if (!note) throw new NotFoundException("Примечание не найдено");
        await this.prisma.marketingCampaignNote.delete({ where: { id: noteId } });
        await this.logger.log("SYSTEM", `Админ удалил примечание кампании ${id}`, adminId, { campaignId: id, noteId }).catch(() => undefined);
        return { success: true };
    }

    // ──────────────── Подробная аналитика ────────────────

    async detail(id: string, query: CampaignStatsQueryDto) {
        const campaign = await this.prisma.marketingCampaign.findUnique({
            where: { id },
            include: {
                expenses: { orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }] },
                notes: { orderBy: { createdAt: "desc" } },
            },
        });
        if (!campaign) throw new NotFoundException("Кампания не найдена");

        const today = this.utcDay(new Date());
        const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : this.utcDay(campaign.createdAt);
        const toDay = query.to ? new Date(`${query.to}T00:00:00.000Z`) : today;
        if (from.getTime() > toDay.getTime()) throw new BadRequestException("Начало периода позже конца");
        const to = new Date(toDay.getTime() + DAY_MS);
        const bucket: Bucket = (to.getTime() - from.getTime()) / DAY_MS > MAX_DAILY_POINTS ? "week" : "day";

        const [allTime, period, series, users] = await Promise.all([
            this.totals(id),
            this.totals(id, from, to),
            this.series(id, from, to, bucket),
            this.recentUsers(id, from, to),
        ]);

        const { expenses, notes, ...rest } = campaign;
        return {
            ...this.present(rest, allTime),
            expenses: expenses.map((x) => ({ ...x, amount: Number(x.amount) })),
            notes,
            period: { from: from.toISOString().slice(0, 10), to: toDay.toISOString().slice(0, 10), bucket, stats: this.metrics(period) },
            series,
            users,
        };
    }

    private async totals(campaignId: string, from?: Date, to?: Date): Promise<Totals> {
        const range = (col: string) =>
            from && to ? Prisma.sql`AND ${Prisma.raw(col)} >= ${from} AND ${Prisma.raw(col)} < ${to}` : Prisma.empty;

        const [[u], [t], [p], [r], [e]] = await Promise.all([
            this.prisma.$queryRaw<Array<{ c: number }>>`
                SELECT COUNT(*)::int AS c FROM users WHERE utm_campaign_id = ${campaignId} ${range("created_at")}`,
            this.prisma.$queryRaw<Array<{ c: number }>>`
                SELECT COUNT(*)::int AS c FROM users WHERE utm_campaign_id = ${campaignId} AND trial IS NOT NULL ${range("trial")}`,
            this.prisma.$queryRaw<Array<{ payers: number; payments: number; revenue: number }>>`
                SELECT COUNT(DISTINCT p.user_id)::int AS payers, COUNT(*)::int AS payments, COALESCE(SUM(p."amountUsd"), 0)::float8 AS revenue
                FROM payments p
                JOIN users u ON u.id = p.user_id
                WHERE u.utm_campaign_id = ${campaignId}
                  AND p.status = 'PAID'
                  AND p.provider::text = ANY(${PAID_PROVIDERS})
                  ${range("p.created_at")}`,
            this.prisma.$queryRaw<Array<{ c: number }>>`
                SELECT COUNT(*)::int AS c
                FROM users r
                JOIN users u ON u.id = r.referrer_id
                WHERE u.utm_campaign_id = ${campaignId} ${range("r.created_at")}`,
            this.prisma.$queryRaw<Array<{ s: number }>>`
                SELECT COALESCE(SUM(amount), 0)::float8 AS s FROM marketing_campaign_expenses WHERE campaign_id = ${campaignId} ${range("spent_at")}`,
        ]);

        return {
            registrations: u?.c ?? 0,
            trials: t?.c ?? 0,
            payers: p?.payers ?? 0,
            payments: p?.payments ?? 0,
            revenue: Number(p?.revenue ?? 0),
            referrals: r?.c ?? 0,
            spend: Number(e?.s ?? 0),
        };
    }

    private async series(campaignId: string, from: Date, to: Date, bucket: Bucket) {
        const b = (col: string) => Prisma.raw(`to_char(date_trunc('${bucket}', ${col}), 'YYYY-MM-DD')`);

        const [regs, trials, pays, spend] = await Promise.all([
            this.prisma.$queryRaw<Array<{ b: string; c: number }>>`
                SELECT ${b("created_at")} AS b, COUNT(*)::int AS c
                FROM users
                WHERE utm_campaign_id = ${campaignId} AND created_at >= ${from} AND created_at < ${to}
                GROUP BY 1`,
            this.prisma.$queryRaw<Array<{ b: string; c: number }>>`
                SELECT ${b("trial")} AS b, COUNT(*)::int AS c
                FROM users
                WHERE utm_campaign_id = ${campaignId} AND trial >= ${from} AND trial < ${to}
                GROUP BY 1`,
            this.prisma.$queryRaw<Array<{ b: string; payments: number; payers: number; revenue: number }>>`
                SELECT ${b("p.created_at")} AS b,
                       COUNT(*)::int AS payments,
                       COUNT(DISTINCT p.user_id)::int AS payers,
                       COALESCE(SUM(p."amountUsd"), 0)::float8 AS revenue
                FROM payments p
                JOIN users u ON u.id = p.user_id
                WHERE u.utm_campaign_id = ${campaignId}
                  AND p.status = 'PAID'
                  AND p.provider::text = ANY(${PAID_PROVIDERS})
                  AND p.created_at >= ${from} AND p.created_at < ${to}
                GROUP BY 1`,
            this.prisma.$queryRaw<Array<{ b: string; s: number }>>`
                SELECT ${b("spent_at")} AS b, COALESCE(SUM(amount), 0)::float8 AS s
                FROM marketing_campaign_expenses
                WHERE campaign_id = ${campaignId} AND spent_at >= ${from} AND spent_at < ${to}
                GROUP BY 1`,
        ]);

        const points = new Map<string, { date: string; registrations: number; trials: number; payments: number; payers: number; revenue: number; spend: number }>();
        const start = bucket === "week" ? this.utcWeek(from) : from;
        const step = bucket === "week" ? 7 * DAY_MS : DAY_MS;
        for (let ts = start.getTime(); ts < to.getTime(); ts += step) {
            const date = new Date(ts).toISOString().slice(0, 10);
            points.set(date, { date, registrations: 0, trials: 0, payments: 0, payers: 0, revenue: 0, spend: 0 });
        }
        for (const r of regs) if (points.has(r.b)) points.get(r.b)!.registrations = r.c;
        for (const r of trials) if (points.has(r.b)) points.get(r.b)!.trials = r.c;
        for (const r of pays) {
            const pt = points.get(r.b);
            if (!pt) continue;
            pt.payments = r.payments;
            pt.payers = r.payers;
            pt.revenue = Math.round(Number(r.revenue) * 100) / 100;
        }
        for (const r of spend) if (points.has(r.b)) points.get(r.b)!.spend = Math.round(Number(r.s) * 100) / 100;
        return [...points.values()];
    }

    private async recentUsers(campaignId: string, from: Date, to: Date) {
        const rows = await this.prisma.$queryRaw<Array<{ id: string; email: string; tg_login: string | null; created_at: Date; trial: Date | null; revenue: number; referrals: number }>>`
            SELECT u.id, u.email, u.tg_login, u.created_at, u.trial,
                   COALESCE((SELECT SUM(p."amountUsd") FROM payments p
                             WHERE p.user_id = u.id AND p.status = 'PAID' AND p.provider::text = ANY(${PAID_PROVIDERS})), 0)::float8 AS revenue,
                   (SELECT COUNT(*) FROM users r WHERE r.referrer_id = u.id)::int AS referrals
            FROM users u
            WHERE u.utm_campaign_id = ${campaignId} AND u.created_at >= ${from} AND u.created_at < ${to}
            ORDER BY u.created_at DESC
            LIMIT 50`;
        return rows.map((r) => ({
            id: r.id,
            email: r.email,
            tgLogin: r.tg_login,
            createdAt: r.created_at,
            trial: r.trial,
            revenue: Number(r.revenue),
            referrals: r.referrals,
        }));
    }

    // ──────────────── Helpers ────────────────

    private metrics(t: Totals) {
        const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
        const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
        return {
            ...t,
            cpa: ratio(t.spend, t.registrations),
            avgLtv: ratio(t.revenue, t.registrations),
            cac: ratio(t.spend, t.payers),
            arppu: ratio(t.revenue, t.payers),
            romi: t.spend > 0 ? ((t.revenue - t.spend) / t.spend) * 100 : null,
            trialRate: pct(t.trials, t.registrations),
            payerRate: pct(t.payers, t.registrations),
        };
    }

    private present(c: { id: string; name: string; source: string; utmSource: string; slug: string; createdAt: Date; updatedAt: Date }, totals: Totals) {
        return {
            id: c.id,
            name: c.name,
            source: c.source,
            utmSource: c.utmSource,
            slug: c.slug,
            link: this.linkOf(c.utmSource, c.slug),
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            stats: this.metrics(totals),
        };
    }

    private linkOf(utmSource: string, slug: string) {
        const host = (this.config.get<string>("HOST") ?? "").replace(/\/$/, "");
        const params = new URLSearchParams({ utm_source: utmSource, utm_medium: UTM_MEDIUM, utm_campaign: slug });
        return `${host}/?${params.toString()}`;
    }

    private utmSourceOf(source: string) {
        return SOURCE_UTM[source] ?? (this.slugify(source).replace(/-/g, "_") || "other");
    }

    private slugify(value: string) {
        return value
            .toLowerCase()
            .split("")
            .map((ch) => TRANSLIT[ch] ?? ch)
            .join("")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40)
            .replace(/-+$/g, "");
    }

    private emptyTotals(): Totals {
        return { registrations: 0, trials: 0, payers: 0, payments: 0, revenue: 0, referrals: 0, spend: 0 };
    }

    private utcDay(d: Date) {
        const x = new Date(d);
        x.setUTCHours(0, 0, 0, 0);
        return x;
    }

    private utcWeek(d: Date) {
        const x = this.utcDay(d);
        const day = x.getUTCDay();
        x.setUTCDate(x.getUTCDate() - (day === 0 ? 6 : day - 1));
        return x;
    }

    private async findOrThrow(id: string) {
        const campaign = await this.prisma.marketingCampaign.findUnique({ where: { id } });
        if (!campaign) throw new NotFoundException("Кампания не найдена");
        return campaign;
    }
}
