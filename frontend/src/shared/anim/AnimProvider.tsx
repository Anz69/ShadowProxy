"use client"

import { useEffect } from "react"

import { ScrollTrigger, ensureGsap } from "./gsap"

/**
 * Mounted once at the root. Registers GSAP and keeps ScrollTrigger in sync with
 * the app's body `zoom`/scale wrapper (recomputed on resize/orientation by
 * ScaleProvider) by refreshing trigger positions after the scale settles.
 */
export default function AnimProvider() {
	useEffect(() => {
		ensureGsap()
		let t: ReturnType<typeof setTimeout>
		const refresh = () => {
			clearTimeout(t)
			// wait for ScaleProvider to update --viewport-scale + layout to settle
			t = setTimeout(() => ScrollTrigger.refresh(), 200)
		}
		window.addEventListener("resize", refresh, { passive: true })
		window.addEventListener("orientationchange", refresh, { passive: true })
		return () => {
			clearTimeout(t)
			window.removeEventListener("resize", refresh)
			window.removeEventListener("orientationchange", refresh)
		}
	}, [])

	return null
}
