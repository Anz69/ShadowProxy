/**
 * Гейтинг новых типов прокси по спринтам — чтобы можно было выкатывать сборку
 * по-спринтово, не удаляя код.
 *
 * Все новые типы (ISP_USA, ISP_EU, RESIDENTIAL_LITE) открыты для продажи.
 * Чтобы закрыть тип — добавь его в массив и пересобери.
 */
export const DISABLED_PROXY_TYPES: readonly string[] = [];

export const isProxyTypeDisabled = (t: string | null | undefined): boolean =>
    !!t && DISABLED_PROXY_TYPES.includes(t);
