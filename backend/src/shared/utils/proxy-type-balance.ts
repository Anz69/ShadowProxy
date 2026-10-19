/**
 * Какой столбец остатка на users отвечает за тип прокси, и сколько байт ещё можно
 * пропустить через gateway. Агент получает это как `bytes_limit` и рвёт соединения
 * сам, не дожидаясь 5-секундного отчёта в CORE (иначе быстрая загрузка перелетает
 * лимит на сотни мегабайт).
 *
 * null — тариф учитывается на стороне провайдера (ProxyEmpire): лимит не передаём.
 */
export const BALANCE_FIELD_BY_PROXY_TYPE: Record<string, string | null> = {
    RESIDENT: "residentTrafficLeft",
    RESIDENT_PREMIUM: "premiumTrafficLeft",
    MOBILE_GB: "mobileGbTrafficLeft",
    IPV6_GB: "ipv6GbTrafficLeft",
    ISP_USA: "ispUsaTrafficLeft",
    ISP_EU: "ispEuTrafficLeft",
    RESIDENTIAL_LITE: "residentialLiteTrafficLeft",
    PREMIUM_RESIDENTIAL: null,
    MOBILE: null,
};

/** Prisma select с теми же полями — чтобы не тянуть пользователя целиком. */
export const BALANCE_FIELDS_SELECT = {
    residentTrafficLeft: true,
    premiumTrafficLeft: true,
    mobileGbTrafficLeft: true,
    ipv6GbTrafficLeft: true,
    ispUsaTrafficLeft: true,
    ispEuTrafficLeft: true,
    residentialLiteTrafficLeft: true,
} as const;

/**
 * Остаток в байтах для агента: число ≥ 0, либо null (без лимита — провайдерский учёт
 * или нет данных о пользователе). Дробные/битые значения считаются нулём.
 */
export function remainingBytesForProxyType(user: Record<string, unknown> | null | undefined, proxyType: string): number | null {
    const field = BALANCE_FIELD_BY_PROXY_TYPE[proxyType];
    if (!field || !user) return null;
    const raw = user[field];
    if (raw === undefined || raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
}

/** Поле `bytes_limit` для payload агента: undefined, когда лимита нет. */
export function bytesLimitForAgent(user: Record<string, unknown> | null | undefined, proxyType: string): { bytes_limit?: number } {
    const remaining = remainingBytesForProxyType(user, proxyType);
    return remaining === null ? {} : { bytes_limit: remaining };
}
