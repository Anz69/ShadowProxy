import { Injectable, NotFoundException } from "@nestjs/common";
import { SetSettingDto } from "./dtos/set-setting.dto";
import { SettingsService } from "../settings/settings.service";
import { LoggerService } from "../logger/logger.service";
import { ProxyService } from "../proxy/proxy.service";
import { ProxyEmpireProvider } from "../proxy/providers/services/proxy-empire.provider";
import { LogType, ProxyStatus, Prisma } from "@prisma/client";
import { ModifyPricesDto } from "./dtos/modify-prices.dto";
import { GetLogsDto } from "./dtos/get-logs.dto";
import { PrismaService } from "../prisma/prisma.service";
import { UserService } from "../user/user.service";
import { CloudflareAnalyticsService } from "./cloudflare-analytics.service";
import { CreateBroadcastDto, BroadcastSegment } from "./dtos/create-broadcast.dto";

@Injectable()
export class AdminService {
    constructor(
        private readonly settingService: SettingsService,
        private readonly logger: LoggerService,
        private readonly proxyService: ProxyService,
        private readonly proxyEmpireProvider: ProxyEmpireProvider,
        private readonly prisma: PrismaService,
        private readonly userService: UserService,
        private readonly cloudflareAnalytics: CloudflareAnalyticsService,
    ) {}

    // ──────────────── Массовые рассылки (Часть 5.3) ────────────────

    /** Prisma-where для сегмента аудитории. */
    private broadcastSegmentWhere(segment: BroadcastSegment): Prisma.UserWhereInput {
        switch (segment) {
            case "trial_active":
                // Триал выдан и ещё не истёк.
                return { trial: { not: null, gte: new Date() } };
            case "after_purchase":
                // Есть хотя бы один пакет или платёж.
                return { OR: [{ packages: { some: {} } }, { payments: { some: {} } }] };
            case "no_purchases":
                return { packages: { none: {} }, payments: { none: {} } };
            case "all":
            default:
                return {};
        }
    }

    /** Кол-во получателей по сегменту (для предпросмотра). */
    async broadcastAudienceCount(segment: BroadcastSegment) {
        const count = await this.prisma.user.count({ where: this.broadcastSegmentWhere(segment) });
        return { count };
    }

    /** Создать рассылку: доставить как уведомления всем юзерам сегмента + записать в историю. */
    async createBroadcast(dto: CreateBroadcastDto, adminId: string) {
        const where = this.broadcastSegmentWhere(dto.segment);
        const users = await this.prisma.user.findMany({ where, select: { id: true } });

        if (users.length > 0) {
            await this.prisma.notification.createMany({
                data: users.map((u) => ({
                    userId: u.id,
                    type: "broadcast",
                    title: dto.title,
                    body: dto.body,
                    link: dto.link || null,
                })),
            });
        }

        const broadcast = await this.prisma.broadcast.create({
            data: {
                title: dto.title,
                body: dto.body,
                link: dto.link || null,
                segment: dto.segment,
                recipientsCount: users.length,
            },
        });

        await this.logger.log(
            "SYSTEM",
            `Админ ${adminId} отправил рассылку "${dto.title}" (${dto.segment}) — ${users.length} получателей`,
            adminId,
            { broadcastId: broadcast.id, segment: dto.segment, recipients: users.length },
        );

        return broadcast;
    }

    /** История рассылок (новые сначала). */
    async listBroadcasts(page = 1, limit = 30) {
        const take = Math.min(Math.max(1, limit), 100);
        const skip = (Math.max(1, page) - 1) * take;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.broadcast.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
            this.prisma.broadcast.count(),
        ]);
        return { items, total, page: Math.max(1, page) };
    }

    async setSetting(dto: SetSettingDto, userId: string) {
        await this.logger.log("SYSTEM", `Админ ${userId} установил новое значение для параметра "${dto.key}"`, userId, {
            ...dto.value,
        });
        await this.logger.logUserAction({
            userId,
            actionType: "SETTINGS_CHANGE",
            message: `Админ ${userId} изменил настройку "${dto.key}"`,
            metadata: {
                settingKey: dto.key,
                settingValue: dto.value,
            },
        });
        return this.settingService.setKey(dto.key, dto.value);
    }

    async modifyPrices(dto: ModifyPricesDto, userId: string) {
        await this.logger.log("SYSTEM", `Админ ${userId} установил новые цены`, userId, {
            ...dto,
        });
        await this.settingService.setKey("proxy_tariffications", {
            resident_premium: dto.resident_premium,
            mobile_gb: dto.mobile_gb,
            ipv6_gb: dto.ipv6_gb,
            premium_residential: dto.premium_residential ?? 1.5,
        });
        await this.settingService.setKey("mobile_tariffications", { options: dto.mobile });
        return dto;
    }

    async getStats() {
        const now = Date.now();
        // Все агрегаты ниже считаются по окнам максимум «месяц» — логи старше месяца
        // на результат не влияют. Раньше грузились ВСЕ REPLENISH/USAGE-логи за всю
        // историю: /admin/stats замедлялся линейно с ростом таблицы logs.
        const monthAgo = new Date(now - 2_592_000_000);
        const [allProxy, repleinishLogs, usageLogs, usersTotal] = await Promise.all([
            this.proxyService.findMany({ where: { status: ProxyStatus.ACTIVE } }),
            this.logger.getLogs({ where: { type: LogType.REPLENISH, createdAt: { gte: monthAgo } } }),
            this.logger.getLogs({ where: { type: LogType.USAGE, createdAt: { gte: monthAgo } } }),
            this.prisma.user.count(),
        ]);
        const t = {
            hour: now - 3600_000,
            day: now - 86_400_000,
            week: now - 604_800_000,
            month: now - 2_592_000_000,
        };

        const zerosNum = () => ({ hour: 0, day: 0, week: 0, month: 0 });
        const zerosBig = () => ({ hour: 0n, day: 0n, week: 0n, month: 0n });

        const mapType = (v: unknown) => {
            const s = String(v ?? "").toUpperCase();
            if (s === "RESIDENT") return "resident" as const;
            if (s === "RESIDENT_PREMIUM") return "premium" as const;
            if (s === "PREMIUM_RESIDENTIAL") return "premiumResidential" as const;
            if (s === "MOBILE") return "mobile" as const;
            if (s === "MOBILE_GB") return "mobileGb" as const;
            if (s === "IPV6_GB") return "ipv6" as const;
            return undefined;
        };

        const proxy = { ...zerosNum(), resident: zerosNum(), premium: zerosNum(), premiumResidential: zerosNum(), mobile: zerosNum(), mobileGb: zerosNum(), ipv6: zerosNum() };
        for (const p of allProxy) {
            const ts = new Date(p.createdAt).getTime();
            const key = mapType((p as { type?: string }).type);
            if (ts >= t.hour) {
                proxy.hour++;
                if (key) (proxy as any)[key].hour++;
            }
            if (ts >= t.day) {
                proxy.day++;
                if (key) (proxy as any)[key].day++;
            }
            if (ts >= t.week) {
                proxy.week++;
                if (key) (proxy as any)[key].week++;
            }
            if (ts >= t.month) {
                proxy.month++;
                if (key) (proxy as any)[key].month++;
            }
        }

        const replenish = {
            ...zerosNum(),
            resident: zerosNum(),
            premium: zerosNum(),
            premiumResidential: zerosNum(),
            mobile: zerosNum(),
            mobileGb: zerosNum(),
            ipv6: zerosNum(),
        };
        for (const log of repleinishLogs) {
            const ts = new Date(log.createdAt).getTime();
            const amount = Number((log?.metadata as { amount?: number | string })?.amount ?? 0);
            if (!Number.isFinite(amount)) continue;
            const key = mapType((log?.metadata as { type?: string })?.type);
            if (ts >= t.hour) {
                replenish.hour += amount;
                if (key) (replenish as any)[key].hour += amount;
            }
            if (ts >= t.day) {
                replenish.day += amount;
                if (key) (replenish as any)[key].day += amount;
            }
            if (ts >= t.week) {
                replenish.week += amount;
                if (key) (replenish as any)[key].week += amount;
            }
            if (ts >= t.month) {
                replenish.month += amount;
                if (key) (replenish as any)[key].month += amount;
            }
        }

        const bytesAll = zerosBig();
        const bytesResident = zerosBig();
        const bytesPremium = zerosBig();
        const bytesPremiumResidential = zerosBig();
        const bytesMobileGb = zerosBig();
        const bytesIpv6 = zerosBig();

        for (const log of usageLogs) {
            const ts = new Date(log.createdAt).getTime();
            const key = mapType((log?.metadata as { type?: string })?.type);

            if (key === "mobile") continue;

            let used = 0n;
            try {
                const raw = ((log?.metadata as { used?: string | number })?.used ?? "0").toString();
                used = BigInt(raw);
            } catch {}

            if (ts >= t.hour) {
                bytesAll.hour += used;
                if (key === "resident") bytesResident.hour += used;
                else if (key === "premium") bytesPremium.hour += used;
                else if (key === "premiumResidential") bytesPremiumResidential.hour += used;
                else if (key === "mobileGb") bytesMobileGb.hour += used;
                else if (key === "ipv6") bytesIpv6.hour += used;
            }
            if (ts >= t.day) {
                bytesAll.day += used;
                if (key === "resident") bytesResident.day += used;
                else if (key === "premium") bytesPremium.day += used;
                else if (key === "premiumResidential") bytesPremiumResidential.day += used;
                else if (key === "mobileGb") bytesMobileGb.day += used;
                else if (key === "ipv6") bytesIpv6.day += used;
            }
            if (ts >= t.week) {
                bytesAll.week += used;
                if (key === "resident") bytesResident.week += used;
                else if (key === "premium") bytesPremium.week += used;
                else if (key === "premiumResidential") bytesPremiumResidential.week += used;
                else if (key === "mobileGb") bytesMobileGb.week += used;
                else if (key === "ipv6") bytesIpv6.week += used;
            }
            if (ts >= t.month) {
                bytesAll.month += used;
                if (key === "resident") bytesResident.month += used;
                else if (key === "premium") bytesPremium.month += used;
                else if (key === "premiumResidential") bytesPremiumResidential.month += used;
                else if (key === "mobileGb") bytesMobileGb.month += used;
                else if (key === "ipv6") bytesIpv6.month += used;
            }
        }

        const GB = 1024n ** 3n;
        const toGb = (b: bigint) => {
            const i = b / GB;
            const r = b % GB;
            const v = Number(i) + Number(r) / Number(GB);
            return Math.round(v * 1000) / 1000;
        };

        const usageGb = {
            hour: toGb(bytesAll.hour),
            day: toGb(bytesAll.day),
            week: toGb(bytesAll.week),
            month: toGb(bytesAll.month),
            resident: {
                hour: toGb(bytesResident.hour),
                day: toGb(bytesResident.day),
                week: toGb(bytesResident.week),
                month: toGb(bytesResident.month),
            },
            premium: {
                hour: toGb(bytesPremium.hour),
                day: toGb(bytesPremium.day),
                week: toGb(bytesPremium.week),
                month: toGb(bytesPremium.month),
            },
            premiumResidential: {
                hour: toGb(bytesPremiumResidential.hour),
                day: toGb(bytesPremiumResidential.day),
                week: toGb(bytesPremiumResidential.week),
                month: toGb(bytesPremiumResidential.month),
            },
            mobile: { hour: 999, day: 999, week: 999, month: 999 },
            mobileGb: {
                hour: toGb(bytesMobileGb.hour),
                day: toGb(bytesMobileGb.day),
                week: toGb(bytesMobileGb.week),
                month: toGb(bytesMobileGb.month),
            },
            ipv6: {
                hour: toGb(bytesIpv6.hour),
                day: toGb(bytesIpv6.day),
                week: toGb(bytesIpv6.week),
                month: toGb(bytesIpv6.month),
            },
        };

        return { proxy, replenish, usageGb, usersTotal };
    }

    /** Данные для графиков: оборот, новые пользователи, трафик по дням/типам, активность, посещения в месяц (Cloudflare) */
    async getChartsStats() {
        const now = new Date();
        const msDay = 86_400_000;
        const msWeek = 604_800_000;
        const msMonth = 2_592_000_000;
        const monthAgo = new Date(now.getTime() - 12 * msMonth);

        const monthlyVisitsPromise = this.cloudflareAnalytics.getMonthlyVisits();

        const mapType = (v: unknown) => {
            const s = String(v ?? "").toUpperCase();
            if (s === "RESIDENT") return "resident" as const;
            if (s === "RESIDENT_PREMIUM") return "premium" as const;
            if (s === "PREMIUM_RESIDENTIAL") return "premiumResidential" as const;
            if (s === "MOBILE") return "mobile" as const;
            if (s === "MOBILE_GB") return "mobileGb" as const;
            if (s === "IPV6_GB") return "ipv6" as const;
            return undefined;
        };

        const dayStart = (d: Date) => {
            const x = new Date(d);
            x.setUTCHours(0, 0, 0, 0);
            return x.toISOString().slice(0, 10);
        };
        const weekStart = (d: Date) => {
            const x = new Date(d);
            const day = x.getUTCDay();
            const diff = x.getUTCDate() - day + (day === 0 ? -6 : 1);
            x.setUTCDate(diff);
            x.setUTCHours(0, 0, 0, 0);
            return x.toISOString().slice(0, 10);
        };
        const monthStart = (d: Date) => {
            const x = new Date(d);
            x.setUTCDate(1);
            x.setUTCHours(0, 0, 0, 0);
            return x.toISOString().slice(0, 10);
        };
        const hourStart = (d: Date) => {
            const x = new Date(d);
            x.setUTCMinutes(0, 0, 0);
            return x.toISOString().slice(0, 13);
        };

        const msHour = 3600_000;
        const hour24Ago = new Date(now.getTime() - 24 * msHour);
        const day24Ago = new Date(now.getTime() - 24 * msDay);

        const [replenishLogs, allUsers, usageLogs, logs24h, logs24d, logs12w, logs12m, proxies24h, proxies24d, proxies12w, proxies12m, proxyStats] = await Promise.all([
            this.logger.getLogs({
                where: { type: LogType.REPLENISH, createdAt: { gte: monthAgo } },
            }),
            this.prisma.user.findMany({
                where: { createdAt: { gte: monthAgo } },
                select: { createdAt: true },
            }),
            this.logger.getLogs({
                where: {
                    type: LogType.USAGE,
                    createdAt: { gte: monthAgo },
                },
            }),
            this.prisma.log.findMany({
                where: { createdAt: { gte: hour24Ago } },
                select: { userId: true, createdAt: true },
            }),
            this.prisma.log.findMany({
                where: { createdAt: { gte: day24Ago } },
                select: { userId: true, createdAt: true },
            }),
            this.prisma.log.findMany({
                where: { createdAt: { gte: new Date(now.getTime() - 12 * msWeek) } },
                select: { userId: true, createdAt: true },
            }),
            this.prisma.log.findMany({
                where: { createdAt: { gte: monthAgo } },
                select: { userId: true, createdAt: true },
            }),
            this.prisma.proxy.findMany({
                where: { createdAt: { gte: hour24Ago } },
                select: { createdAt: true, type: true },
            }),
            this.prisma.proxy.findMany({
                where: { createdAt: { gte: day24Ago } },
                select: { createdAt: true, type: true },
            }),
            this.prisma.proxy.findMany({
                where: { createdAt: { gte: new Date(now.getTime() - 12 * msWeek) } },
                select: { createdAt: true, type: true },
            }),
            this.prisma.proxy.findMany({
                where: { createdAt: { gte: monthAgo } },
                select: { createdAt: true, type: true },
            }),
            this.getStats(),
        ]);

        const revenueByDay: Record<string, { sum: number; count: number }> = {};
        const revenueByWeek: Record<string, { sum: number; count: number }> = {};
        const revenueByMonth: Record<string, { sum: number; count: number }> = {};
        for (const log of replenishLogs) {
            const amount = Number((log?.metadata as { amount?: number | string })?.amount ?? 0);
            if (!Number.isFinite(amount)) continue;
            const d = new Date(log.createdAt);
            const dKey = dayStart(d);
            const wKey = weekStart(d);
            const mKey = monthStart(d);
            if (!revenueByDay[dKey]) revenueByDay[dKey] = { sum: 0, count: 0 };
            revenueByDay[dKey].sum += amount;
            revenueByDay[dKey].count += 1;
            if (!revenueByWeek[wKey]) revenueByWeek[wKey] = { sum: 0, count: 0 };
            revenueByWeek[wKey].sum += amount;
            revenueByWeek[wKey].count += 1;
            if (!revenueByMonth[mKey]) revenueByMonth[mKey] = { sum: 0, count: 0 };
            revenueByMonth[mKey].sum += amount;
            revenueByMonth[mKey].count += 1;
        }

        const newUsersByDay: Record<string, number> = {};
        const newUsersByWeek: Record<string, number> = {};
        const newUsersByMonth: Record<string, number> = {};
        for (const u of allUsers) {
            const d = new Date(u.createdAt);
            const dKey = dayStart(d);
            const wKey = weekStart(d);
            const mKey = monthStart(d);
            newUsersByDay[dKey] = (newUsersByDay[dKey] ?? 0) + 1;
            newUsersByWeek[wKey] = (newUsersByWeek[wKey] ?? 0) + 1;
            newUsersByMonth[mKey] = (newUsersByMonth[mKey] ?? 0) + 1;
        }

        const emptyTraffic = () => ({ totalGb: 0, resident: 0, premium: 0, premiumResidential: 0, mobile: 0, mobileGb: 0, ipv6: 0 });
        const trafficByDay: Record<string, { totalGb: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }> = {};
        const trafficByWeek: Record<string, { totalGb: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }> = {};
        const trafficByMonth: Record<string, { totalGb: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }> = {};
        const GB = 1024 ** 3;
        for (const log of usageLogs) {
            let used = 0;
            try {
                const raw = ((log?.metadata as { used?: string | number })?.used ?? "0").toString();
                used = Number(BigInt(raw));
            } catch {}
            const d = new Date(log.createdAt);
            const dKey = dayStart(d);
            const wKey = weekStart(d);
            const mKey = monthStart(d);
            const typeKey = mapType((log?.metadata as { type?: string })?.type);
            const gb = used / GB;
            if (!trafficByDay[dKey]) trafficByDay[dKey] = emptyTraffic();
            trafficByDay[dKey].totalGb += gb;
            if (typeKey === "resident") trafficByDay[dKey].resident += gb;
            else if (typeKey === "premium") trafficByDay[dKey].premium += gb;
            else if (typeKey === "premiumResidential") trafficByDay[dKey].premiumResidential += gb;
            else if (typeKey === "mobile") trafficByDay[dKey].mobile += gb;
            else if (typeKey === "mobileGb") trafficByDay[dKey].mobileGb += gb;
            else if (typeKey === "ipv6") trafficByDay[dKey].ipv6 += gb;
            if (!trafficByWeek[wKey]) trafficByWeek[wKey] = emptyTraffic();
            trafficByWeek[wKey].totalGb += gb;
            if (typeKey === "resident") trafficByWeek[wKey].resident += gb;
            else if (typeKey === "premium") trafficByWeek[wKey].premium += gb;
            else if (typeKey === "premiumResidential") trafficByWeek[wKey].premiumResidential += gb;
            else if (typeKey === "mobile") trafficByWeek[wKey].mobile += gb;
            else if (typeKey === "mobileGb") trafficByWeek[wKey].mobileGb += gb;
            else if (typeKey === "ipv6") trafficByWeek[wKey].ipv6 += gb;
            if (!trafficByMonth[mKey]) trafficByMonth[mKey] = emptyTraffic();
            trafficByMonth[mKey].totalGb += gb;
            if (typeKey === "resident") trafficByMonth[mKey].resident += gb;
            else if (typeKey === "premium") trafficByMonth[mKey].premium += gb;
            else if (typeKey === "premiumResidential") trafficByMonth[mKey].premiumResidential += gb;
            else if (typeKey === "mobile") trafficByMonth[mKey].mobile += gb;
            else if (typeKey === "mobileGb") trafficByMonth[mKey].mobileGb += gb;
            else if (typeKey === "ipv6") trafficByMonth[mKey].ipv6 += gb;
        }

        const countDistinct = (arr: { userId: string | null }[]) => {
            const set = new Set(arr.map((x) => x.userId).filter(Boolean));
            return set.size;
        };

        const activeByHour: Record<string, Set<string>> = {};
        for (const log of logs24h) {
            const key = hourStart(new Date(log.createdAt));
            if (!activeByHour[key]) activeByHour[key] = new Set();
            if (log.userId) activeByHour[key].add(log.userId);
        }
        const activeByDay: Record<string, Set<string>> = {};
        for (const log of logs24d) {
            const key = dayStart(new Date(log.createdAt));
            if (!activeByDay[key]) activeByDay[key] = new Set();
            if (log.userId) activeByDay[key].add(log.userId);
        }
        const activeByWeek: Record<string, Set<string>> = {};
        for (const log of logs12w) {
            const key = weekStart(new Date(log.createdAt));
            if (!activeByWeek[key]) activeByWeek[key] = new Set();
            if (log.userId) activeByWeek[key].add(log.userId);
        }
        const activeByMonth: Record<string, Set<string>> = {};
        for (const log of logs12m) {
            const key = monthStart(new Date(log.createdAt));
            if (!activeByMonth[key]) activeByMonth[key] = new Set();
            if (log.userId) activeByMonth[key].add(log.userId);
        }

        const proxyTypeKey = (t: string) => {
            const s = String(t ?? "").toUpperCase();
            if (s === "RESIDENT") return "resident" as const;
            if (s === "RESIDENT_PREMIUM") return "premium" as const;
            if (s === "PREMIUM_RESIDENTIAL") return "premiumResidential" as const;
            if (s === "MOBILE") return "mobile" as const;
            if (s === "MOBILE_GB") return "mobileGb" as const;
            if (s === "IPV6_GB") return "ipv6" as const;
            return undefined;
        };
        const emptyProxyBucket = () => ({ count: 0, resident: 0, premium: 0, premiumResidential: 0, mobile: 0, mobileGb: 0, ipv6: 0 });
        const proxyByHour: Record<string, { count: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }> = {};
        for (const p of proxies24h) {
            const key = hourStart(new Date(p.createdAt));
            if (!proxyByHour[key]) proxyByHour[key] = emptyProxyBucket();
            proxyByHour[key].count += 1;
            const tk = proxyTypeKey((p as { type: string }).type);
            if (tk) (proxyByHour[key] as any)[tk] += 1;
        }
        const proxyByDay: Record<string, { count: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }> = {};
        for (const p of proxies24d) {
            const key = dayStart(new Date(p.createdAt));
            if (!proxyByDay[key]) proxyByDay[key] = emptyProxyBucket();
            proxyByDay[key].count += 1;
            const tk = proxyTypeKey((p as { type: string }).type);
            if (tk) (proxyByDay[key] as any)[tk] += 1;
        }
        const proxyByWeek: Record<string, { count: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }> = {};
        for (const p of proxies12w) {
            const key = weekStart(new Date(p.createdAt));
            if (!proxyByWeek[key]) proxyByWeek[key] = emptyProxyBucket();
            proxyByWeek[key].count += 1;
            const tk = proxyTypeKey((p as { type: string }).type);
            if (tk) (proxyByWeek[key] as any)[tk] += 1;
        }
        const proxyByMonth: Record<string, { count: number; resident: number; premium: number; premiumResidential: number; mobile: number; mobileGb: number; ipv6: number }> = {};
        for (const p of proxies12m) {
            const key = monthStart(new Date(p.createdAt));
            if (!proxyByMonth[key]) proxyByMonth[key] = emptyProxyBucket();
            proxyByMonth[key].count += 1;
            const tk = proxyTypeKey((p as { type: string }).type);
            if (tk) (proxyByMonth[key] as any)[tk] += 1;
        }

        const sortKeys = (obj: Record<string, unknown>) => Object.keys(obj).sort();
        const revenueDay = sortKeys(revenueByDay).slice(-24).map((date) => ({ date, sum: revenueByDay[date].sum, count: revenueByDay[date].count }));
        const revenueWeek = sortKeys(revenueByWeek).slice(-12).map((date) => ({ date, sum: revenueByWeek[date].sum, count: revenueByWeek[date].count }));
        const revenueMonth = sortKeys(revenueByMonth).slice(-12).map((date) => ({ date, sum: revenueByMonth[date].sum, count: revenueByMonth[date].count }));
        const totalRevenueDay = revenueDay.reduce((a, p) => a + p.sum, 0);
        const totalRevenueWeek = revenueWeek.reduce((a, p) => a + p.sum, 0);
        const totalRevenueMonth = revenueMonth.reduce((a, p) => a + p.sum, 0);
        const totalCountDay = revenueDay.reduce((a, p) => a + p.count, 0);
        const totalCountWeek = revenueWeek.reduce((a, p) => a + p.count, 0);
        const totalCountMonth = revenueMonth.reduce((a, p) => a + p.count, 0);

        const newUsersDay = sortKeys(newUsersByDay).slice(-24).map((date) => ({ date, count: newUsersByDay[date] }));
        const newUsersWeek = sortKeys(newUsersByWeek).slice(-12).map((date) => ({ date, count: newUsersByWeek[date] }));
        const newUsersMonth = sortKeys(newUsersByMonth).slice(-12).map((date) => ({ date, count: newUsersByMonth[date] }));

        const trafficByDayList = sortKeys(trafficByDay).slice(-30).map((date) => ({ date, ...trafficByDay[date] }));
        const trafficByWeekList = sortKeys(trafficByWeek).slice(-12).map((date) => ({ date, ...trafficByWeek[date] }));
        const trafficByMonthList = sortKeys(trafficByMonth).slice(-12).map((date) => ({ date, ...trafficByMonth[date] }));

        const usageGb = proxyStats.usageGb;
        const trafficByType = {
            resident: usageGb.resident.month,
            premium: usageGb.premium.month,
            premiumResidential: usageGb.premiumResidential.month,
            mobile: usageGb.mobile.month === 999 ? 0 : usageGb.mobile.month,
            mobileGb: usageGb.mobileGb.month,
            ipv6: usageGb.ipv6.month,
        };

        const activeUsersByHour = sortKeys(activeByHour).map((date) => ({ date, count: activeByHour[date].size }));
        const activeUsersByDay = sortKeys(activeByDay).map((date) => ({ date, count: activeByDay[date].size }));
        const activeUsersByWeek = sortKeys(activeByWeek).slice(-12).map((date) => ({ date, count: activeByWeek[date].size }));
        const activeUsersByMonth = sortKeys(activeByMonth).slice(-12).map((date) => ({ date, count: activeByMonth[date].size }));
        const proxyByHourList = sortKeys(proxyByHour).map((date) => ({ date, ...proxyByHour[date] }));
        const proxyByDayList = sortKeys(proxyByDay).map((date) => ({ date, ...proxyByDay[date] }));
        const proxyByWeekList = sortKeys(proxyByWeek).slice(-12).map((date) => ({ date, ...proxyByWeek[date] }));
        const proxyByMonthList = sortKeys(proxyByMonth).slice(-12).map((date) => ({ date, ...proxyByMonth[date] }));

        const monthlyVisits = await monthlyVisitsPromise;

        return {
            monthlyVisits,
            revenue: {
                byDay: revenueDay,
                byWeek: revenueWeek,
                byMonth: revenueMonth,
                totalDay: { sum: totalRevenueDay, count: totalCountDay },
                totalWeek: { sum: totalRevenueWeek, count: totalCountWeek },
                totalMonth: { sum: totalRevenueMonth, count: totalCountMonth },
            },
            newUsers: {
                byDay: newUsersDay,
                byWeek: newUsersWeek,
                byMonth: newUsersMonth,
            },
            trafficByDay: trafficByDayList,
            trafficByWeek: trafficByWeekList,
            trafficByMonth: trafficByMonthList,
            trafficByType,
            activity: {
                activeUsers: {
                    byHour: activeUsersByHour,
                    byDay: activeUsersByDay,
                    byWeek: activeUsersByWeek,
                    byMonth: activeUsersByMonth,
                },
                proxyGenerations: {
                    byHour: proxyByHourList,
                    byDay: proxyByDayList,
                    byWeek: proxyByWeekList,
                    byMonth: proxyByMonthList,
                },
            },
        };
    }

    async getLogs(dto: GetLogsDto) {
        const page = dto.page ? parseInt(dto.page, 10) || 1 : 1;
        const limit = dto.limit ? parseInt(dto.limit, 10) || 50 : 50;
        const { type, userId, email, startDate, endDate } = dto;

        const where: Prisma.LogWhereInput = {};

        if (type) {
            where.type = type;
        }

        if (userId) {
            where.userId = userId;
        } else if (email) {
            // Находим userId по email
            const user = await this.userService.findByEmail(email, false);
            if (user) {
                where.userId = user.id;
            } else {
                // Если пользователь не найден, возвращаем пустой результат
                return {
                    logs: [],
                    total: 0,
                    page,
                    limit,
                    totalPages: 0,
                };
            }
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.createdAt.lte = new Date(endDate);
            }
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            this.prisma.log.findMany({
                where,
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: limit,
            }),
            this.prisma.log.count({ where }),
        ]);

        return {
            logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getLogDetail(id: string) {
        const log = await this.prisma.log.findUnique({
            where: { id },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                        },
                    },
                },
        });

        if (!log) {
            throw new NotFoundException("Лог не найден");
        }

        return log;
    }

    async syncProxyEmpireQuotas(): Promise<{ synced: number; failed: number; errors: { email: string; reason: string }[] }> {
        const users = await this.prisma.user.findMany({
            where: {
                OR: [
                    { premiumResidentialTrafficLeft: { not: "0" } } as any,
                    { mobileTrafficLeft: { not: "0" } } as any,
                ],
            },
            select: { id: true, email: true, premiumResidentialTrafficLeft: true, mobileTrafficLeft: true } as any,
        });

        let synced = 0;
        let failed = 0;
        const errors: { email: string; reason: string }[] = [];

        for (const u of users as unknown as Array<{ id: string; email: string; premiumResidentialTrafficLeft: string; mobileTrafficLeft: string }>) {
            try {
                const apiToken = await this.proxyService.ensureProxyEmpireSubUser(u.id);
                if (!apiToken) {
                    failed++;
                    errors.push({ email: u.email, reason: "ensureProxyEmpireSubUser returned null (см. логи бэка для деталей)" });
                    continue;
                }

                const prBytes = Number(BigInt(u.premiumResidentialTrafficLeft || "0"));
                const mobileBytes = Number(BigInt(u.mobileTrafficLeft || "0"));

                let anySuccess = false;
                if (prBytes > 0) {
                    const ok = await this.proxyEmpireProvider.setSubUserBandwidth(u.email, "residential", prBytes);
                    if (ok) anySuccess = true;
                    else errors.push({ email: u.email, reason: `setSubUserBandwidth residential failed (см. логи)` });
                }
                if (mobileBytes > 0) {
                    const ok = await this.proxyEmpireProvider.setSubUserBandwidth(u.email, "mobile", mobileBytes);
                    if (ok) anySuccess = true;
                    else errors.push({ email: u.email, reason: `setSubUserBandwidth mobile failed (см. логи)` });
                }

                if (anySuccess) synced++;
                else failed++;
            } catch (e: any) {
                failed++;
                errors.push({ email: u.email, reason: e?.message || String(e) });
            }
        }

        await this.logger.log("SYSTEM", `Admin sync ProxyEmpire quotas: synced=${synced}, failed=${failed}, total_users=${users.length}`);
        return { synced, failed, errors };
    }
}
