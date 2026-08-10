"use client"

import { useEffect } from "react"

/**
 * Scroll-driven "stacking cards" effect for the landing's sticky panels.
 * As the next card slides over the current one, the current card recedes —
 * scales down and fades. Only `transform` and `opacity` are animated: both are
 * GPU-composited, so it stays smooth at any scroll speed (an earlier version
 * used `filter: blur()`, which re-rasterised the whole card every frame and
 * janked hard). Values are quantised so we only write when something changes.
 */
const PIN_TOP = 116 // matches the panels' `sticky top-[116px]`
const STEPS = 30

export default function StackScroll() {
	useEffect(() => {
		if (typeof window === "undefined") return
		const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
		const cards = Array.from(
			document.querySelectorAll<HTMLElement>("[data-stack-card]")
		)
		if (reduce || cards.length < 2) return

		// Promote to their own layers up front so scrolling never triggers raster.
		cards.forEach(c => {
			c.style.willChange = "transform, opacity"
		})

		const lastStep = new Array(cards.length).fill(-1)
		let raf = 0
		let lastY = -1

		const apply = () => {
			for (let i = 0; i < cards.length; i++) {
				const next = cards[i + 1]
				if (!next) continue
				const cur = cards[i]
				const h = cur.offsetHeight || 1
				const nextTop = next.getBoundingClientRect().top
				const p = Math.min(1, Math.max(0, (PIN_TOP + h - nextTop) / h))
				const step = Math.round(p * STEPS)
				if (step === lastStep[i]) continue
				lastStep[i] = step
				const q = step / STEPS
				if (q <= 0) {
					cur.style.transform = ""
					cur.style.opacity = ""
				} else {
					// translateZ keeps it on the compositor layer; scale + fade recede.
					cur.style.transform = `translateZ(0) scale(${(1 - 0.06 * q).toFixed(4)})`
					cur.style.opacity = (1 - 0.5 * q).toFixed(3)
				}
			}
		}

		const tick = () => {
			const y = window.scrollY || document.documentElement.scrollTop || 0
			if (y !== lastY) {
				lastY = y
				apply()
			}
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)

		return () => {
			cancelAnimationFrame(raf)
			cards.forEach(c => {
				c.style.willChange = ""
			})
		}
	}, [])

	return null
}
