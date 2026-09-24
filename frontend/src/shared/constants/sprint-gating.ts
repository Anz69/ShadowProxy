/**
 * Гейтинг новых типов прокси по спринтам (зеркалит backend/src/shared/constants/sprint-gating.ts).
 *
 * Все новые типы (ISP_USA, ISP_EU, RESIDENTIAL_LITE) открыты: карточки видны в UI.
 * Чтобы скрыть тип — добавь его в массив и пересобери фронт.
 */
export const DISABLED_PROXY_TYPES: readonly string[] = []

export const isProxyTypeDisabled = (t: string | null | undefined): boolean =>
	!!t && DISABLED_PROXY_TYPES.includes(t)
