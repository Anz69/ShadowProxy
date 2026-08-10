"use client"

import { useEffect } from "react"

import { ensureGsap, gsap, prefersReducedMotion } from "./gsap"
import { REVEAL_FROM, type RevealVariant } from "./Reveal"

export type RevealConfig = {
	/** CSS selector (queried within document; scope to page-specific classes) */
	selector: string
	variant?: RevealVariant
	/** seconds between matched elements */
	stagger?: number
	/** IO threshold 0..1 */
	amount?: number
	delay?: number
	duration?: number
	/** play immediately on mount (use for above-the-fold groups like the hero) */
	immediate?: boolean
}

/**
 * Selector-driven reveal wiring for server-rendered pages. One <Reveals
 * config={[...]} /> per page; sets up a scroll reveal per selector group.
 *
 * Design notes (why this shape):
 *  - The app scales the whole <body> via CSS `zoom`, which makes manual
 *    getBoundingClientRect-vs-innerHeight math unreliable. IntersectionObserver
 *    is viewport-correct under zoom, so we rely on it ALONE for scroll triggers
 *    (no manual coordinate checks).
 *  - `immediate: true` groups (above the fold, e.g. hero) play on mount.
 *  - A long unconditional safety net guarantees content is NEVER left hidden if
 *    IO somehow never fires — but it's long enough that real scrolling reveals
 *    first, so below-the-fold groups still animate on scroll.
 * Plain useEffect (not useGSAP) avoids dev double-invoke auto-revert.
 * Respects prefers-reduced-motion.
 */
export default function Reveals({ config }: { config: RevealConfig[] }) {
	useEffect(() => {
		ensureGsap()
		const reduced = prefersReducedMotion()
		const cleanups: Array<() => void> = []

		for (const c of config) {
			const els = gsap.utils.toArray<HTMLElement>(c.selector)
			if (!els.length) continue

			if (reduced) {
				gsap.set(els, { autoAlpha: 1, clearProps: "transform,filter,visibility" })
				continue
			}

			gsap.set(els, REVEAL_FROM[c.variant ?? "up"])

			let played = false
			const play = () => {
				if (played) return
				played = true
				gsap.to(els, {
					autoAlpha: 1,
					x: 0,
					y: 0,
					scale: 1,
					filter: "blur(0px)",
					duration: c.duration ?? 0.95,
					delay: c.delay ?? 0,
					ease: "power3.out",
				force3D: true,
					stagger: c.stagger ?? 0,
					clearProps: "transform,filter,visibility"
				})
			}
			// Аварийный показ БЕЗ анимации — чтобы reveal не «проигрывался» за
			// пределами экрана, если IntersectionObserver почему-то не сработал.
			const forceShow = () => {
				if (played) return
				played = true
				gsap.set(els, {
					autoAlpha: 1,
					x: 0,
					y: 0,
					scale: 1,
					filter: "blur(0px)",
					clearProps: "transform,filter,visibility"
				})
			}

			// Observe every element so the group reveals when any part scrolls in.
			const io = new IntersectionObserver(
				entries => {
					if (entries.some(e => e.isIntersecting)) {
						play()
						io.disconnect()
					}
				},
				{ threshold: c.amount ?? 0.15, rootMargin: "0px 0px -10% 0px" }
			)
			els.forEach(el => io.observe(el))

			let immediateRaf = 0
			if (c.immediate) {
				immediateRaf = requestAnimationFrame(play)
			}

			// Аварийная сеть: контент никогда не остаётся скрытым. Для групп ниже
			// сгиба показываем МГНОВЕННО (forceShow, без анимации) и с большим
			// окном — чтобы реальный скролл-reveal через IO успел сыграть первым,
			// а анимация не «проигрывалась» вне экрана.
			const safety = window.setTimeout(
				c.immediate ? play : forceShow,
				c.immediate ? 400 : 12000
			)

			cleanups.push(() => {
				io.disconnect()
				if (immediateRaf) cancelAnimationFrame(immediateRaf)
				clearTimeout(safety)
			})
		}

		return () => cleanups.forEach(fn => fn())
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return null
}
