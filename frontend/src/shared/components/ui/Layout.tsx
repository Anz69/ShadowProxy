import type { FC, ReactNode } from "react"

import type { User } from "@/features/user/types/user.types"
import type { SupportedLocale } from "@/shared/utils/i18n"

type LayoutProps = {
	children: ReactNode
	blob?: boolean
	user?: User | null | undefined
	header?: boolean
	locale?: SupportedLocale
}

/**
 * Passthrough. The site chrome (Header/Footer) now lives in persistent
 * route-group layouts: app/(app)/layout.tsx for content pages and
 * app/auth/layout.tsx for auth pages — so it no longer remounts on navigation.
 * This component is kept (with its old props) only so existing
 * `<Layout>…</Layout>` wrappers across pages don't need editing.
 */
const Layout: FC<LayoutProps> = ({ children }) => {
	return <>{children}</>
}

export default Layout
