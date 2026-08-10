"use client"

import type { CSSProperties, ElementType, ReactNode } from "react"
import { useRef } from "react"

import { ensureGsap, gsap, prefersReducedMotion, useGSAP } from "./gsap"

export type RevealVariant =
	| "up"
	| "fade"
	| "scale"
	| "left"
	| "right"
	| "blur"
	| "rise"

// Premium: larger travel + blur-in for depth; clears after settle.
export const REVEAL_FROM: Record<RevealVariant, gsap.TweenVars> = {
	up: { y: 40, autoAlpha: 0, filter: "blur(5px)" },
	fade: { autoAlpha: 0, filter: "blur(4px)" },
	scale: { scale: 0.94, autoAlpha: 0, filter: "blur(5px)" },
	left: { x: -44, autoAlpha: 0, filter: "blur(4px)" },
	right: { x: 44, autoAlpha: 0, filter: "blur(4px)" },
	blur: { autoAlpha: 0, filter: "blur(10px)", scale: 1.03 },
	rise: { y: 64, autoAlpha: 0, filter: "blur(6px)" }
}
const FROM = REVEAL_FROM

type RevealProps = {
	children: ReactNode
	as?: ElementType
	variant?: RevealVariant
	delay?: number
	duration?: number
	/** Stagger direct children instead of the wrapper itself. number = seconds. */
	stagger?: boolean | number
	/** IntersectionObserver threshold 0..1 */
	amount?: number
	once?: boolean
	className?: string
	style?: CSSProperties
}

/**
 * IntersectionObserver-triggered GSAP reveal. IO is immune to the app's body
 * `zoom`/`scale` wrapper, so reveals fire correctly across browsers. GSAP only
 * drives the motion. Respects prefers-reduced-motion (renders final state).
 */
export default function Reveal({
	children,
	as: Tag = "div",
	variant = "up",
	delay = 0,
	duration = 0.95,
	stagger = false,
	amount = 0.12,
	once = true,
	className,
	style
}: RevealProps) {
	const ref = useRef<HTMLElement>(null)

	useGSAP(
		() => {
			ensureGsap()
			const el = ref.current
			if (!el) return

			const targets: gsap.TweenTarget = stagger
				? gsap.utils.toArray(el.children)
				: el

			if (prefersReducedMotion()) {
				gsap.set(targets, { autoAlpha: 1, clearProps: "transform,visibility" })
				return
			}

			gsap.set(targets, FROM[variant])

			let played = false
			const play = () => {
				if (played) return
				played = true
				gsap.to(targets, {
					autoAlpha: 1,
					x: 0,
					y: 0,
					scale: 1,
					filter: "blur(0px)",
					duration,
					delay,
					ease: "power3.out",
				force3D: true,
					stagger: stagger
						? typeof stagger === "number"
							? stagger
							: { each: 0.07, from: "start" }
						: 0,
					// remove inline transform/filter/visibility so CSS :hover keeps working
					clearProps: "transform,filter,visibility"
				})
			}

			const io = new IntersectionObserver(
				entries => {
					for (const e of entries) {
						if (e.isIntersecting) {
							play()
							if (once) io.disconnect()
						}
					}
				},
				{ threshold: amount, rootMargin: "0px 0px -8% 0px" }
			)
			io.observe(el)

			// In view or already scrolled past at mount → reveal now (IO can be
			// flaky under the body zoom/scale wrapper). Truly-below-fold waits for
			// the observer; backstop checks the same condition so off-screen
			// content is never revealed early nor left stuck hidden once seen.
			const check = () => {
				if (el.getBoundingClientRect().top < window.innerHeight * 0.92) play()
			}
			check()
			const fallback = window.setTimeout(check, 1200)

			return () => {
				io.disconnect()
				clearTimeout(fallback)
			}
		},
		{ scope: ref, dependencies: [variant, delay, duration, amount, once] }
	)

	const Comp = Tag as ElementType
	return (
		<Comp ref={ref as never} className={className} style={style}>
			{children}
		</Comp>
	)
}
