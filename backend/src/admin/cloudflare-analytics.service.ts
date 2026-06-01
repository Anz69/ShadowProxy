import { Injectable } from "@nestjs/common";
import axios from "axios";

const LOG_PREFIX = "[Cloudflare Analytics]";

export type MonthlyVisitsResult = {
    byDay: { date: string; visits: number }[];
    total: number;
} | null;

/**
 * Статистика посещений сайта через Cloudflare GraphQL Analytics API.
 * В .env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ANALYTICS_DOMAIN (без https).
 */
@Injectable()
export class CloudflareAnalyticsService {
    private readonly apiUrl = "https://api.cloudflare.com/client/v4/graphql";
    private readonly zonesUrl = "https://api.cloudflare.com/client/v4/zones";

    async getMonthlyVisits(): Promise<MonthlyVisitsResult> {
        const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
        const domain = process.env.CLOUDFLARE_ANALYTICS_DOMAIN?.trim();

        if (!token) {
            console.log(LOG_PREFIX, "Пропуск: CLOUDFLARE_API_TOKEN не задан");
            return null;
        }
        if (!domain) {
            console.log(LOG_PREFIX, "Пропуск: CLOUDFLARE_ANALYTICS_DOMAIN не задан");
            return null;
        }
        console.log(LOG_PREFIX, "Домен:", domain, "| Токен задан:", !!token);

        const zoneId = await this.getZoneIdByDomain(token, domain);
        if (!zoneId) {
            console.warn(LOG_PREFIX, "Зона не найдена по домену:", domain);
            return null;
        }
        console.log(LOG_PREFIX, "Zone ID получен:", zoneId.slice(0, 8) + "...");

        // Запрашиваем только прошедшие 30 дней (от «сейчас» назад), без будущих дат.
        // Лимит API: один отрезок не шире 8 дней; данные старше 8 дней часто недоступны — тогда вернётся только последний отрезок.
        const now = new Date();
        const toEnd = new Date(now.getTime() + 60000);
        const dayMs = 24 * 60 * 60 * 1000;
        const segmentDays = 8;
        const ranges: { from: Date; to: Date }[] = [];
        for (let end = toEnd.getTime(); end > toEnd.getTime() - 30 * dayMs; end -= segmentDays * dayMs) {
            const start = Math.max(end - segmentDays * dayMs, toEnd.getTime() - 30 * dayMs);
            if (start >= end) break;
            ranges.push({ from: new Date(start), to: new Date(end) });
        }

        try {
            const results = await Promise.all(
                ranges.map((r, i) =>
                    this.fetchVisitsInRange(token, zoneId, domain, r.from, r.to, i + 1, ranges.length),
                ),
            );
            const successful = results.filter((r): r is { date: string; visits: number }[] => r !== null);
            if (successful.length === 0) {
                console.warn(LOG_PREFIX, "Ни один отрезок за последние 30 дней не вернул данных");
                return null;
            }
            if (successful.length < ranges.length) {
                console.warn(LOG_PREFIX, "Успешно только", successful.length, "из", ranges.length, "отрезков (данные старше 8 дней могут быть недоступны в API)");
            }
            const merged = new Map<string, number>();
            for (const byDay of successful) {
                for (const { date, visits } of byDay) {
                    merged.set(date, (merged.get(date) ?? 0) + visits);
                }
            }
            const byDay = Array.from(merged.entries())
                .map(([date, visits]) => ({ date, visits }))
                .sort((a, b) => a.date.localeCompare(b.date));
            const total = byDay.reduce((acc, r) => acc + r.visits, 0);
            console.log(LOG_PREFIX, "Итог: запрос за последние 30 дней, получено дней:", byDay.length, "| всего посещений:", total);
            return { byDay, total };
        } catch (err: any) {
            console.warn(LOG_PREFIX, "Ошибка:", err?.message ?? err);
            return null;
        }
    }

    /** Один запрос за диапазон не более 8 дней (лимит API). */
    private async fetchVisitsInRange(
        token: string,
        zoneId: string,
        domain: string,
        datetimeFrom: Date,
        datetimeTo: Date,
        segmentIndex: number,
        segmentTotal: number,
    ): Promise<{ date: string; visits: number }[] | null> {
        const fromStr = datetimeFrom.toISOString().slice(0, 10);
        const toStr = datetimeTo.toISOString().slice(0, 10);
        console.log(LOG_PREFIX, `Запрос ${segmentIndex}/${segmentTotal}: ${fromStr} .. ${toStr}`);

        const filter: Record<string, string> = {
            datetime_geq: datetimeFrom.toISOString(),
            datetime_lt: datetimeTo.toISOString(),
            clientRequestHTTPHost: domain,
            requestSource: "eyeball",
        };
        const query = `
query MonthlyVisits($zoneTag: string!, $filter: HttpRequestsAdaptiveGroupsFilter_InputObject) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(limit: 1000, filter: $filter) {
        sum { visits }
        dimensions { date }
      }
    }
  }
}`.replace(/\s+/g, " ");

        try {
            const { data } = await axios.post<{
                data?: {
                    viewer?: {
                        zones?: Array<{
                            httpRequestsAdaptiveGroups?: Array<{
                                sum?: { visits?: number };
                                dimensions?: { date?: string };
                            }>;
                        }>;
                    };
                };
                errors?: Array<{ message?: string }>;
            }>(
                this.apiUrl,
                { query, variables: { zoneTag: zoneId, filter } },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 15000,
                },
            );
            if (data.errors?.length) {
                console.warn(LOG_PREFIX, `Запрос ${segmentIndex}/${segmentTotal} GraphQL errors:`, JSON.stringify(data.errors));
                return null;
            }
            const groups = data.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
            const byDay = groups
                .filter((g): g is { sum?: { visits?: number }; dimensions?: { date?: string } } => g != null)
                .map((g) => ({
                    date: (g.dimensions?.date ?? "").slice(0, 10) || "unknown",
                    visits: g.sum?.visits ?? 0,
                }))
                .filter((r) => r.date !== "unknown");
            const sum = byDay.reduce((acc, r) => acc + r.visits, 0);
            console.log(LOG_PREFIX, `Запрос ${segmentIndex}/${segmentTotal} OK: дней=${byDay.length}, посещений=${sum}`);
            return byDay;
        } catch (err: any) {
            console.warn(LOG_PREFIX, `Запрос ${segmentIndex}/${segmentTotal} ошибка:`, err?.message ?? err);
            if (err?.response?.data) {
                console.warn(LOG_PREFIX, "Ответ:", JSON.stringify(err.response.data).slice(0, 400));
            }
            return null;
        }
    }

    private async getZoneIdByDomain(token: string, domain: string): Promise<string | null> {
        try {
            const url = `${this.zonesUrl}?name=${encodeURIComponent(domain)}`;
            const { data } = await axios.get<{ success?: boolean; result?: Array<{ id: string; name: string }>; errors?: Array<{ message?: string }> }>(
                url,
                { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 },
            );
            if (data.errors?.length) {
                console.warn(LOG_PREFIX, "Zones API errors:", JSON.stringify(data.errors));
                return null;
            }
            const zone = data.result?.[0];
            if (data.success && zone?.id) return zone.id;
            console.warn(LOG_PREFIX, "Зона не найдена. result:", data.result?.length ?? 0);
            return null;
        } catch (err: any) {
            console.warn(LOG_PREFIX, "Ошибка Zones API:", err?.message ?? err);
            if (err?.response?.data) console.warn(LOG_PREFIX, "Zones ответ:", JSON.stringify(err.response.data).slice(0, 300));
            return null;
        }
    }
}
