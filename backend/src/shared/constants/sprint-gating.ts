/**
 * Гейтинг новых типов прокси по спринтам — чтобы можно было выкатывать сборку
 * по-спринтово, не удаляя код.
 *
 * Sprint 2 = включён только ISP_USA. ISP_EU и RESIDENTIAL_LITE (Sprint 3) отключены:
 * бэкенд блокирует их покупку/генерацию, фронт прячет карточки.
 *
 * Чтобы открыть Sprint 3 — очисти массив (`[]`) и пересобери.
 */
// Sprint 3 открыт: ISP_EU + Residential Lite включены. (Sprint 2 было ["ISP_EU","RESIDENTIAL_LITE"].)
export const DISABLED_PROXY_TYPES: readonly string[] = [];

export const isProxyTypeDisabled = (t: string | null | undefined): boolean =>
    !!t && DISABLED_PROXY_TYPES.includes(t);
