import type { ReactNode } from "react"

export default function AdminLayout({ children }: { children: ReactNode }) {
	return <div className="sp-admin w-full min-w-0">{children}</div>
}
