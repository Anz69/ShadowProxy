/**
 * Гейтинг новых типов прокси по спринтам — чтобы можно было выкатывать сборку
 * по-спринтово, не удаляя код.
 *
 * ISP EU временно закрыт для новых продаж. Mango (RESIDENT_PREMIUM) включён.
 * Чтобы закрыть тип — добавь его в массив и пересобери.
 */
export const DISABLED_PROXY_TYPES: readonly string[] = ["ISP_EU"];

export const isProxyTypeDisabled = (t: string | null | undefined): boolean =>
    !!t && DISABLED_PROXY_TYPES.includes(t);
