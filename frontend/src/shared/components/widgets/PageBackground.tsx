/**
 * Premium page atmosphere — slow-drifting aurora blobs + a faint rotating sheen
 * and a "network" dot texture, all pure CSS (crisp, light, theme-aware) and
 * gently animated. Drop it as the first child of a `relative` full-bleed wrapper;
 * page content sits above it. Sits behind everything (-z-10).
 *
 * Tuned to be calm and refined — no harsh single-corner bleed. Respects
 * prefers-reduced-motion (animation freezes for those users).
 */
export default function PageBackground() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
			<style>{`
				@keyframes pb-drift-a {
					0%   { transform: translate3d(0,0,0) scale(1); }
					100% { transform: translate3d(6%,4%,0) scale(1.12); }
				}
				@keyframes pb-drift-b {
					0%   { transform: translate3d(0,0,0) scale(1.05); }
					100% { transform: translate3d(-5%,-3%,0) scale(0.95); }
				}
				@keyframes pb-drift-c {
					0%   { transform: translate3d(-3%,2%,0) scale(0.98); }
					100% { transform: translate3d(4%,-4%,0) scale(1.1); }
				}
				@keyframes pb-spin {
					from { transform: rotate(0deg); }
					to   { transform: rotate(360deg); }
				}
				@keyframes pb-breathe {
					0%, 100% { opacity: 0.55; }
					50%      { opacity: 0.9; }
				}
				.pb-blob { will-change: transform; animation-timing-function: ease-in-out; animation-iteration-count: infinite; animation-direction: alternate; }
				@media (prefers-reduced-motion: reduce) {
					.pb-blob, .pb-spin, .pb-breathe { animation: none !important; }
				}
			`}</style>

			{/* faint rotating aurora sheen (very subtle, sits lowest) */}
			<div
				className="pb-spin absolute left-1/2 top-[-30%] h-[1100px] w-[1100px] -translate-x-1/2 rounded-full opacity-[0.5] blur-[40px] bg-[conic-gradient(from_0deg,rgba(0,103,255,0.10),rgba(52,211,238,0.06),rgba(99,102,241,0.10),rgba(0,103,255,0.10))] [mask-image:radial-gradient(circle,#000_30%,transparent_70%)] light:opacity-[0.6] light:bg-[conic-gradient(from_0deg,rgba(47,107,255,0.06),rgba(52,211,238,0.04),rgba(99,102,241,0.05),rgba(47,107,255,0.06))]"
				style={{ animation: "pb-spin 90s linear infinite" }}
			/>

			{/* drifting aurora blobs — spread across the canvas, soft and low */}
			<div
				className="pb-blob absolute -top-[14%] right-[6%] h-[560px] w-[560px] rounded-full blur-[110px] bg-[radial-gradient(circle,rgba(0,103,255,0.22),transparent_62%)] light:bg-[radial-gradient(circle,rgba(47,107,255,0.10),transparent_64%)]"
				style={{ animation: "pb-drift-a 22s ease-in-out infinite alternate" }}
			/>
			<div
				className="pb-blob absolute top-[30%] -left-[8%] h-[520px] w-[520px] rounded-full blur-[120px] bg-[radial-gradient(circle,rgba(52,211,238,0.13),transparent_64%)] light:bg-[radial-gradient(circle,rgba(52,211,238,0.07),transparent_66%)]"
				style={{ animation: "pb-drift-b 26s ease-in-out infinite alternate" }}
			/>
			<div
				className="pb-blob absolute bottom-[-16%] left-[40%] h-[600px] w-[600px] rounded-full blur-[120px] bg-[radial-gradient(circle,rgba(99,102,241,0.13),transparent_64%)] light:bg-[radial-gradient(circle,rgba(99,102,241,0.06),transparent_66%)]"
				style={{ animation: "pb-drift-c 30s ease-in-out infinite alternate" }}
			/>
			{/* Точечная текстура/сетка убраны: на лёгких страницах они «мерцали» при
			    переходах (артефакт). Атмосферу держат только мягкие aurora-glow выше.
			    Точечный фон оставлен намеренно только на дашборде (DashboardDots). */}
		</div>
	)
}
