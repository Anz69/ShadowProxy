"use client"

import type { RefObject } from "react"

import {
	ScrollTrigger,
	ensureGsap,
	gsap,
	isFirefox,
	prefersReducedMotion,
	useGSAP
} from "./gsap"

type ParallaxOpts = {
	/** total vertical travel in px across the scroll range (kept small) */
	distance?: number
	/** start offset already applied; we tween y from -distance/2 → +distance/2 */
}

/**
 * Light ScrollTrigger parallax on a background layer. Disabled in Firefox
 * (the body uses -moz-transform: scale which breaks scroll math) and under
 * reduced-motion. Displacement is intentionally small so any residual scale
 * imprecision stays invisible. ScrollTrigger.refresh() on scale change is
 * handled globally by AnimProvider.
 */
export function useParallax(
	ref: RefObject<HTMLElement | null>,
	{ distance = 60 }: ParallaxOpts = {}
) {
	useGSAP(
		() => {
			ensureGsap()
			const el = ref.current
			if (!el) return
			if (prefersReducedMotion() || isFirefox()) return

			const tween = gsap.fromTo(
				el,
				{ y: -distance / 2 },
				{
					y: distance / 2,
					ease: "none",
					scrollTrigger: {
						trigger: el,
						start: "top bottom",
						end: "bottom top",
						scrub: true
					}
				}
			)
			return () => {
				tween.scrollTrigger?.kill()
				tween.kill()
			}
		},
		{ scope: ref, dependencies: [distance] }
	)
	void ScrollTrigger // keep import referenced
}
