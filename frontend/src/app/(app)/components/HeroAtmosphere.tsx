"use client"

import { useEffect, useRef } from "react"

/**
 * Interactive hero backdrop: full-bleed grid + aurora glow that parallax with
 * the cursor, a soft spotlight that follows the mouse, an ambient drift, and a
 * top hairline. CSS vars are updated from a rAF-throttled mousemove; all motion
 * is gated by prefers-reduced-motion. Renders behind content (-z-[1]).
 */
export default function HeroAtmosphere() {
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const el = ref.current
		if (!el) return
		if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

		let raf = 0
		let px = 0
		let py = 0
		let cx = 0
		let cy = 0

		const apply = () => {
			raf = 0
			el.style.setProperty("--px", px.toFixed(3))
			el.style.setProperty("--py", py.toFixed(3))
			el.style.setProperty("--cx", `${cx.toFixed(0)}px`)
			el.style.setProperty("--cy", `${cy.toFixed(0)}px`)
			el.style.setProperty("--on", "1")
		}
		const onMove = (e: MouseEvent) => {
			px = e.clientX / window.innerWidth - 0.5
			py = e.clientY / window.innerHeight - 0.5
			const r = el.getBoundingClientRect()
			cx = e.clientX - r.left
			cy = e.clientY - r.top
			if (!raf) raf = requestAnimationFrame(apply)
		}

		window.addEventListener("mousemove", onMove, { passive: true })
		return () => {
			window.removeEventListener("mousemove", onMove)
			if (raf) cancelAnimationFrame(raf)
		}
	}, [])

	return (
		<div
			ref={ref}
			aria-hidden
			className="pointer-events-none absolute left-1/2 top-0 -z-[1] h-[1200px] w-screen -translate-x-1/2 [--cx:50%] [--cy:32%] [--on:0] [--px:0] [--py:0] [transition:--px_.5s_ease,--py_.5s_ease]"
		>
			{/* grid — subtle cursor parallax */}
			<div className="absolute inset-0 [transform:translate3d(calc(var(--px)*-26px),calc(var(--py)*-18px),0)] bg-[linear-gradient(rgba(130,170,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(130,170,255,0.05)_1px,transparent_1px)] [background-size:60px_60px] [mask-image:radial-gradient(120%_75%_at_50%_14%,#000_26%,transparent_72%)] light:bg-[linear-gradient(rgba(47,107,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(47,107,255,0.045)_1px,transparent_1px)]" />
			{/* aurora — cursor parallax (wrapper) + ambient drift & breathe (inner) */}
			<div className="absolute inset-0 [transform:translate3d(calc(var(--px)*44px),calc(var(--py)*30px),0)]">
				<div className="absolute inset-0 motion-safe:animate-[sp-drift_20s_ease-in-out_infinite,sp-breathe_8s_ease-in-out_infinite] bg-[radial-gradient(42%_46%_at_50%_24%,rgba(79,141,255,0.34),transparent_72%),radial-gradient(75%_42%_at_50%_8%,rgba(52,211,238,0.08),transparent_74%)] light:bg-[radial-gradient(46%_50%_at_50%_22%,rgba(47,107,255,0.20),transparent_70%),radial-gradient(72%_44%_at_50%_4%,rgba(52,211,238,0.12),transparent_74%)]" />
			</div>
			{/* spotlight following the cursor */}
			<div className="absolute h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[var(--on)] blur-[24px] [left:var(--cx)] [top:var(--cy)] [transition:opacity_.6s_ease] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(106,165,255,0.12),transparent_70%)] light:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(47,107,255,0.12),transparent_70%)]" />
			{/* top hairline */}
			<div className="absolute left-1/2 top-0 h-px w-[58%] max-w-[820px] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(106,165,255,0.5),transparent)] light:bg-[linear-gradient(90deg,transparent,rgba(47,107,255,0.4),transparent)]" />
		</div>
	)
}
