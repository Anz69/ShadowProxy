/**
 * Гейтинг новых типов прокси по спринтам (зеркалит backend/src/shared/constants/sprint-gating.ts).
 *
 * ISP EU временно скрыт для новых заказов. Mango (RESIDENT_PREMIUM) включён.
 * Чтобы скрыть тип — добавь его в массив и пересобери фронт.
 */
export const DISABLED_PROXY_TYPES: readonly string[] = ["ISP_EU"]

export const isProxyTypeDisabled = (t: string | null | undefined): boolean =>
	!!t && DISABLED_PROXY_TYPES.includes(t)
