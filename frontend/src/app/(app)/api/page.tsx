import { redirect } from "next/navigation"
import { getLocale } from "@/shared/server/getLocale"
import { addLocaleToPath } from "@/shared/utils/getLocaleFromPath"

/**
 * Редирект со старого маршрута /api на /u-api (маршрут api зарезервирован для бэкенда).
 */
export default async function ApiRedirectPage() {
	const locale = await getLocale()
	redirect(addLocaleToPath("/u-api", locale))
}
