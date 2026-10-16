import { Prisma, PrismaClient, ProxyType } from "@prisma/client";

/**
 * Учёт «всего начислено» по тарифу (user_traffic_credits).
 *
 * Остаток (users.*TrafficLeft) уменьшают gateway, PE-sync и Mango-sync, а расход в
 * traffic_logs пишут не все провайдеры. Поэтому полоска «осталось из купленного»
 * строится от суммы начислений: любое пополнение (оплата, триал, ключ, промо,
 * админка, customer API) обязано пройти через addTrafficCredit.
 */
type DbClient = PrismaClient | Prisma.TransactionClient;

/** Колонка остатка → тариф; RESIDENT (Luna) не продаётся и не учитывается. */
export const TRAFFIC_LEFT_FIELD_TO_TYPE: Record<string, ProxyType> = {
    premiumTrafficLeft: "RESIDENT_PREMIUM",
    premiumResidentialTrafficLeft: "PREMIUM_RESIDENTIAL",
    mobileTrafficLeft: "MOBILE",
    mobileGbTrafficLeft: "MOBILE_GB",
    ipv6GbTrafficLeft: "IPV6_GB",
    ispUsaTrafficLeft: "ISP_USA",
    ispEuTrafficLeft: "ISP_EU",
    residentialLiteTrafficLeft: "RESIDENTIAL_LITE",
};

const toAmount = (bytes: string | bigint): bigint => {
    try {
        return BigInt(bytes || "0");
    } catch {
        return 0n;
    }
};

/** Атомарно прибавляет начисление; ноль/отрицательное игнорируется. */
export async function addTrafficCredit(client: DbClient, userId: string, type: ProxyType | string, bytes: string | bigint): Promise<void> {
    const amount = toAmount(bytes);
    if (amount <= 0n || !(type in ProxyType) || type === "RESIDENT") return;
    const value = amount.toString();
    await client.$executeRaw`
        INSERT INTO "user_traffic_credits" ("id", "user_id", "type", "credited_bytes")
        VALUES (gen_random_uuid()::text, ${userId}, CAST(${type} AS "ProxyType"), ${value})
        ON CONFLICT ("user_id", "type") DO UPDATE
        SET "credited_bytes" = (CAST("user_traffic_credits"."credited_bytes" AS NUMERIC) + CAST(${value} AS NUMERIC))::text,
            "updated_at" = NOW()`;
}

/**
 * Админ уменьшил остаток руками: снимаем ту же дельту с начислений, чтобы полоска
 * не показала «израсходовано» то, что просто забрали. Ниже нового остатка не опускаем.
 */
export async function reduceTrafficCredit(
    client: DbClient,
    userId: string,
    type: ProxyType | string,
    bytes: string | bigint,
    newRemaining: string | bigint,
): Promise<void> {
    const amount = toAmount(bytes);
    if (amount <= 0n || !(type in ProxyType) || type === "RESIDENT") return;
    const value = amount.toString();
    const floor = toAmount(newRemaining).toString();
    await client.$executeRaw`
        UPDATE "user_traffic_credits"
        SET "credited_bytes" = GREATEST(CAST("credited_bytes" AS NUMERIC) - CAST(${value} AS NUMERIC), CAST(${floor} AS NUMERIC))::text,
            "updated_at" = NOW()
        WHERE "user_id" = ${userId} AND "type" = CAST(${type} AS "ProxyType")`;
}

/**
 * Знаменатель полоски: начислено, но не меньше того, что известно напрямую
 * (остаток + зафиксированный расход) — защита от legacy-балансов без истории.
 */
export function trafficCreditTotal(remaining: string | bigint, used: string | bigint, credited: string | bigint | undefined): bigint {
    const r = toAmount(remaining);
    const u = toAmount(used);
    const c = toAmount(credited ?? "0");
    const known = r + u;
    return c > known ? c : known;
}
