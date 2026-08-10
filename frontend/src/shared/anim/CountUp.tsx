"use client"

import type { CSSProperties } from "react"
import { useRef } from "react"

import { ensureGsap, gsap, prefersReducedMotion, useGSAP } from "./gsap"

type CountUpProps = {
	value: number
	decimals?: number
	duration?: number
	prefix?: string
	suffix?: string
	/** thousands separator */
	separator?: string
	className?: string
	style?: CSSProperties
}

const fmt = (
	n: number,
	decimals: number,
	prefix: string,
	suffix: string,
	separator: string
) => {
	const fixed = n.toFixed(decimals)
	const [int, dec] = fixed.split(".")
	const grouped = separator
		? int.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
		: int
	return `${prefix}${dec ? `${grouped}.${dec}` : grouped}${suffix}`
}

/**
 * Number that counts up from 0 → value when scrolled into view. SSR renders the
 * final value (good for no-JS/SEO); client animates before paint to avoid flash.
 */
export default function CountUp({
	value,
	decimals = 0,
	duration = 1.1,
	prefix = "",
	suffix = "",
	separator = "",
	className,
	style
}: CountUpProps) {
	const ref = useRef<HTMLSpanElement>(null)

	useGSAP(
		() => {
			ensureGsap()
			const el = ref.current
			if (!el) return
			const write = (n: number) =>
				(el.textContent = fmt(n, decimals, prefix, suffix, separator))

			if (prefersReducedMotion() || value === 0) {
				write(value)
				return
			}

			write(0)
			const proxy = { n: 0 }
			let played = false
			const play = () => {
				if (played) return
				played = true
				gsap.to(proxy, {
					n: value,
					duration,
					ease: "power2.out",
					onUpdate: () => write(proxy.n),
					// fail-safe: guarantee the final value is shown
					onComplete: () => write(value)
				})
			}
			const io = new IntersectionObserver(
				entries => {
					for (const e of entries) {
						if (e.isIntersecting) {
							play()
							io.disconnect()
						}
					}
				},
				{ threshold: 0.3 }
			)
			io.observe(el)
			// already in view at mount, plus safety timeout → never stuck at 0
			const rect = el.getBoundingClientRect()
			if (rect.top < window.innerHeight && rect.bottom > 0) play()
			const fallback = window.setTimeout(play, 1500)
			return () => {
				io.disconnect()
				clearTimeout(fallback)
			}
		},
		{ scope: ref, dependencies: [value, decimals, prefix, suffix, separator] }
	)

	return (
		<span ref={ref} className={className} style={style}>
			{fmt(value, decimals, prefix, suffix, separator)}
		</span>
	)
}
