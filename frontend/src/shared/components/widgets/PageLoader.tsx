"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

// Module-level guard: once the loader has finished its initial hide we never
// show it again for the lifetime of the tab (the App Router root layout
// persists across client-side navigation, so this normally won't even remount).
let hasHiddenOnce = false

export default function PageLoader() {
	const [active, setActive] = useState(() => !hasHiddenOnce)
	const [hidden, setHidden] = useState(false)

	useEffect(() => {
		if (hasHiddenOnce) return

		let done = false
		let fadeTimer: ReturnType<typeof setTimeout> | undefined
		let unmountTimer: ReturnType<typeof setTimeout> | undefined

		const finish = () => {
			if (done) return
			done = true
			setHidden(true)
			unmountTimer = setTimeout(() => {
				hasHiddenOnce = true
				setActive(false)
			}, 420)
		}

		// Wait for fonts to settle, then one frame so the first styled paint has
		// happened, then reveal — keeps the fade intentional, not a flicker.
		const ready = (document as Document & { fonts?: FontFaceSet }).fonts
		const fontsReady = ready?.ready ?? Promise.resolve()
		Promise.resolve(fontsReady)
			.catch(() => {})
			.then(() => {
				requestAnimationFrame(() => {
					fadeTimer = setTimeout(finish, 80)
				})
			})

		// Hard fallback: never let the overlay stick.
		const failsafe = setTimeout(finish, 2200)
		return () => {
			clearTimeout(failsafe)
			if (fadeTimer) clearTimeout(fadeTimer)
			if (unmountTimer) clearTimeout(unmountTimer)
		}
	}, [])

	if (!active) return null

	// Theme-NEUTRAL splash: a fixed premium navy gradient regardless of the saved
	// theme, so there's no light/dark flip while the page boots. It simply fades
	// out into whatever theme the page renders.
	return (
		<div
			aria-hidden="true"
			className="fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-[420ms] ease-out"
			style={{
				background:
					"radial-gradient(120% 90% at 50% 38%, #0f1b34 0%, #0a1326 55%, #070d1c 100%)",
				opacity: hidden ? 0 : 1,
				pointerEvents: hidden ? "none" : "auto"
			}}
		>
			{/* soft blue aurora behind the mark */}
			<div
				className="pointer-events-none absolute inset-0"
				style={{ background: "radial-gradient(50% 45% at 50% 44%, rgba(79,141,255,0.20), transparent 70%)" }}
			/>

			<div className="loader-rise relative flex flex-col items-center gap-9">
				<div className="relative flex items-center gap-3">
					{/* breathing glow behind the mark (composited opacity/scale) */}
					<span aria-hidden className="loader-glow pointer-events-none absolute left-[-10px] top-1/2 h-14 w-14 rounded-full" />
					<Image
						src="/logo.svg"
						alt="ShadowProxy"
						width={40}
						height={40}
						priority
						className="relative h-10 w-10"
						style={{ filter: "drop-shadow(0 6px 22px rgba(106,165,255,0.45))" }}
					/>
					<span className="relative font-struve text-[26px] font-semibold tracking-tight text-white">
						Shadow<span style={{ color: "#6aa5ff" }}>Proxy</span>
					</span>
				</div>

				{/* slim indeterminate sweep — GPU-composited, smooth even during boot */}
				<div className="loader-track relative h-[3px] w-[210px] overflow-hidden rounded-full">
					<span aria-hidden className="loader-bar" />
				</div>
			</div>

			<style jsx>{`
				.loader-rise {
					animation: loader-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
				}
				@keyframes loader-rise {
					from { opacity: 0; transform: translateY(8px); }
					to { opacity: 1; transform: translateY(0); }
				}

				.loader-glow {
					background: radial-gradient(circle, rgba(106, 165, 255, 0.5), transparent 70%);
					filter: blur(7px);
					will-change: transform, opacity;
					transform: translateZ(0);
					animation: loader-pulse 1.8s ease-in-out infinite;
				}
				@keyframes loader-pulse {
					0%, 100% { opacity: 0.3; transform: translateY(-50%) scale(0.85) translateZ(0); }
					50% { opacity: 0.75; transform: translateY(-50%) scale(1.12) translateZ(0); }
				}

				.loader-track {
					background-color: rgba(255, 255, 255, 0.07);
				}
				.loader-bar {
					position: absolute;
					top: 0;
					bottom: 0;
					left: 0;
					width: 45%;
					border-radius: 9999px;
					background: linear-gradient(90deg, transparent 0%, #6aa5ff 50%, transparent 100%);
					will-change: transform;
					transform: translateZ(0);
					animation: loader-sweep 1.25s cubic-bezier(0.65, 0, 0.35, 1) infinite;
				}
				@keyframes loader-sweep {
					0% { transform: translateX(-110%) translateZ(0); }
					100% { transform: translateX(360%) translateZ(0); }
				}

				@media (prefers-reduced-motion: reduce) {
					.loader-rise, .loader-glow, .loader-bar { animation: none; }
				}
			`}</style>
		</div>
	)
}
