/**
 * Гейтинг новых типов прокси по спринтам (зеркалит backend/src/shared/constants/sprint-gating.ts).
 *
 * Sprint 2 = включён только ISP_USA. ISP_EU / RESIDENTIAL_LITE (Sprint 3) скрыты из UI.
 * Чтобы открыть Sprint 3 — очисти массив (`[]`) и пересобери фронт.
 */
// Sprint 3 открыт: ISP_EU + Residential Lite включены. (Sprint 2 было ["ISP_EU","RESIDENTIAL_LITE"].)
export const DISABLED_PROXY_TYPES: readonly string[] = []

export const isProxyTypeDisabled = (t: string | null | undefined): boolean =>
	!!t && DISABLED_PROXY_TYPES.includes(t)
