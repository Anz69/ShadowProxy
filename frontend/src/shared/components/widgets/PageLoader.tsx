"use client"

import { useEffect, useState } from "react"

// The root layout stays mounted across client navigations. Once the splash has
// left, a later remount in this tab must not put it back over the page.
let dismissed = false

/**
 * First-paint cover. It is a solid sheet and it is removed in one frame.
 * Fading it (or leaving the wordmark up) paints the logo on top of the hero
 * while the page is already visible underneath.
 */
export default function PageLoader() {
	const [visible, setVisible] = useState(() => !dismissed)

	useEffect(() => {
		if (dismissed) {
			setVisible(false)
			return
		}

		const dismiss = () => {
			dismissed = true
			setVisible(false)
		}

		let inner = 0
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(dismiss)
		})
		const failsafe = window.setTimeout(dismiss, 800)

		return () => {
			cancelAnimationFrame(outer)
			cancelAnimationFrame(inner)
			window.clearTimeout(failsafe)
		}
	}, [])

	if (!visible) return null

	return <div aria-hidden="true" className="fixed inset-0 z-[9999] bg-[#070d1c]" />
}
