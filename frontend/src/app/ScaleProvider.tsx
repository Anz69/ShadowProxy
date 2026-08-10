"use client"

/**
 * Passthrough. The app used to render on a fixed 1920px canvas shrunk with
 * `zoom: var(--viewport-scale)`; that zoom system was removed in favour of a
 * native, full-width responsive layout (pages constrain themselves with
 * `max-w-*`). Kept only so existing imports don't break.
 */
export default function ScaleProvider({ children }: { children: React.ReactNode }) {
	return <>{children}</>
}
