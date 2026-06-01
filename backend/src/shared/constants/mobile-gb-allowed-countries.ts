/**
 * Разрешённые ISO 3166-1 alpha-2 для мобильных прокси по ГБ (MOBILE_GB).
 * Синхронизировать с фронтом: frontend/src/shared/constants/mobile-gb-allowed-countries.ts
 */
export const MOBILE_GB_ALLOWED_ISO2_UPPER = [
    "KW",
    "MY",
    "MA",
    "NA",
    "NZ",
    "NG",
    "OM",
    "PH",
    "PL",
    "PT",
    "QA",
    "RO",
    "RU",
    "SA",
    "ES",
    "SE",
    "SY",
    "TW",
    "TH",
    "TT",
    "TN",
    "TR",
    "UA",
    "AE",
    "GB",
    "US",
    "VN",
    "AT",
    "BY",
    "BR",
    "BG",
    "KH",
    "CA",
    "CO",
    "CR",
    "HR",
    "EG",
    "FR",
    "DE",
    "GR",
    "IN",
    "IR",
    "IT",
    "JP",
    "JO",
] as const;

const UPPER_SET = new Set<string>(MOBILE_GB_ALLOWED_ISO2_UPPER);

export function isMobileGbCountryAllowed(iso2: string): boolean {
    if (!iso2 || iso2.length !== 2) return false;
    return UPPER_SET.has(iso2.toUpperCase());
}

/** Для ответов API (как остальные location-списки — lowercase) */
export const MOBILE_GB_ALLOWED_ISO2_LOWER = MOBILE_GB_ALLOWED_ISO2_UPPER.map((c) => c.toLowerCase());
