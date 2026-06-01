"use client"

// App Router re-mounts a template on every navigation. Placing it INSIDE the
// (app) group means only the page content animates on route change — the
// persistent Header/Footer in (app)/layout.tsx stay put. Expressive crossfade:
// blur + scale + slight rise settling on the brand ease. Respects reduced-motion.
import { useEffect, useRef } from "react"

import { BRAND_EASE, ensureGsap, gsap, prefersReducedMotion } from "@/shared/anim/gsap"

export default function AppTemplate({
	children
}: {
	children: React.ReactNode
}) {
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		ensureGsap()
		const el = ref.current
		if (!el) return
		if (prefersReducedMotion()) {
			gsap.set(el, { autoAlpha: 1, clearProps: "all" })
			return
		}
		// Анимируем весь контент страницы при переходе. Блюрить full-viewport
		// элемент дорого (репейнт каждый кадр) — держим blur небольшим (6px),
		// force3D промоутит слой на GPU. Уровень перехода тот же: scale+rise+fade.
		const tween = gsap.fromTo(
			el,
			{ autoAlpha: 0, scale: 0.97, y: 20, filter: "blur(6px)" },
			{
				autoAlpha: 1,
				scale: 1,
				y: 0,
				filter: "blur(0px)",
				duration: 0.7,
				ease: BRAND_EASE,
				force3D: true,
				clearProps: "transform,filter,visibility,opacity"
			}
		)
		return () => {
			tween.kill()
		}
	}, [])

	return (
		<div
			ref={ref}
			className="flex w-full flex-col items-center gap-4 md:gap-6"
		>
			{children}
		</div>
	)
}
