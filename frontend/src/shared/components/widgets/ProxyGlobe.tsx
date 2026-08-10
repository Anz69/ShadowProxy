"use client"

import createGlobe from "cobe"
import { Activity, Zap } from "lucide-react"
import { useEffect, useRef, useState } from "react"

/**
 * Interactive WebGL globe (cobe) of ShadowProxy proxy locations. Each node is a
 * pulsing "radar" marker on the dotted sphere with a floating live card: city,
 * latency (ms) and throughput (MB/s), plus a health dot coloured by ping.
 *
 * On top sits the live network backbone: great-circle arcs between locations
 * that lift off the sphere, each with a glowing packet travelling along it — the
 * user's connection being routed through the proxy network (user → exit IP).
 *
 * Markers, cards, arcs and packets are all projected to 2D every frame with the
 * exact camera derived from cobe's fragment shader, so they track rotation and
 * fade out on the back hemisphere.
 */

type Loc = { city: string; ping: number; speed: number; location: [number, number]; size: number }

// ping = latency in ms, speed = throughput in MB/s (base values; they drift live).
// Latencies are tuned low so every node reads healthy (green / amber, never red).
const LOCATIONS: Loc[] = [
	{ city: "San Francisco", ping: 44, speed: 230, location: [37.77, -122.42], size: 0.03 },
	{ city: "New York", ping: 26, speed: 290, location: [40.71, -74.0], size: 0.03 },
	{ city: "São Paulo", ping: 88, speed: 160, location: [-23.55, -46.63], size: 0.03 },
	{ city: "London", ping: 9, speed: 330, location: [51.5, -0.12], size: 0.03 },
	{ city: "Stockholm", ping: 17, speed: 260, location: [59.33, 18.06], size: 0.03 },
	{ city: "Frankfurt", ping: 11, speed: 310, location: [50.11, 8.68], size: 0.03 },
	{ city: "Dubai", ping: 62, speed: 190, location: [25.2, 55.27], size: 0.03 },
	{ city: "Mumbai", ping: 84, speed: 170, location: [19.07, 72.87], size: 0.03 },
	{ city: "Singapore", ping: 73, speed: 200, location: [1.35, 103.8], size: 0.03 },
	{ city: "Tokyo", ping: 51, speed: 220, location: [35.68, 139.69], size: 0.03 }
]

// Unit position of each node on the sphere (matches cobe's marker maths).
const NODE_DIRS = LOCATIONS.map(l => {
	const latR = (l.location[0] * Math.PI) / 180
	const lngR = (l.location[1] * Math.PI) / 180
	const cosLat = Math.cos(latR)
	return [cosLat * Math.cos(lngR), Math.sin(latR), -cosLat * Math.sin(lngR)] as [number, number, number]
})

// Backbone: routed connections (packet travels from → to). Precompute the
// great-circle angle so the per-frame slerp is cheap.
const idx = (c: string) => LOCATIONS.findIndex(l => l.city === c)
const CONNECTIONS = [
	["San Francisco", "New York"], ["New York", "São Paulo"], ["New York", "London"], ["London", "Frankfurt"],
	["Frankfurt", "Dubai"], ["Dubai", "Mumbai"], ["Mumbai", "Singapore"], ["Singapore", "Tokyo"],
	["San Francisco", "Tokyo"], ["Frankfurt", "Stockholm"]
].map(([from, to]) => {
	const a = idx(from)
	const b = idx(to)
	const A = NODE_DIRS[a]
	const B = NODE_DIRS[b]
	const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))
	const omega = Math.acos(dot)
	return { a, b, omega, sinO: Math.sin(omega) }
})

const THETA = 0.32
const CARD_UP = 64 // px the info card floats above its node
const ARC_SEG = 26 // samples per backbone arc
const ARC_H = 0.16 // how far the arc bulges off the sphere (fraction of radius)

// health colour by latency — tuned so live values stay green / amber (never red)
const pingColor = (ms: number) => (ms < 55 ? "#22c55e" : ms < 140 ? "#f59e0b" : "#ef4444")

const isLight = () =>
	typeof document !== "undefined" &&
	document.documentElement.classList.contains("light")

export default function ProxyGlobe({ className = "", size = 520 }: { className?: string; size?: number }) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const svgRef = useRef<SVGSVGElement>(null)
	const markerRefs = useRef<(HTMLDivElement | null)[]>([])
	const cardRefs = useRef<(HTMLDivElement | null)[]>([])
	const dotRefs = useRef<(HTMLSpanElement | null)[]>([])
	const pingRefs = useRef<(HTMLSpanElement | null)[]>([])
	const speedRefs = useRef<(HTMLSpanElement | null)[]>([])
	const arcRefs = useRef<(SVGPathElement | null)[]>([])
	const lineRefs = useRef<(SVGPathElement | null)[]>([])
	const packetRefs = useRef<(SVGCircleElement | null)[]>([])
	const phaseRef = useRef<number[]>(CONNECTIONS.map((_, i) => (i * 0.131) % 1))
	const [light, setLight] = useState(false)

	// Live ping + throughput: a gentle random walk around each base, with the
	// odd latency spike — updated imperatively (no re-render, no flicker).
	useEffect(() => {
		const ping = LOCATIONS.map(l => l.ping)
		const speed = LOCATIONS.map(l => l.speed)
		const tick = () => {
			for (let i = 0; i < LOCATIONS.length; i++) {
				const bp = LOCATIONS[i].ping
				const spike = Math.random() < 0.1 ? 6 + Math.floor(Math.random() * 18) : 0
				let np = ping[i] + (Math.floor(Math.random() * 7) - 3) + spike
				np = Math.max(Math.max(4, bp - 6), Math.min(bp + 26, np))
				ping[i] = np

				const bs = LOCATIONS[i].speed
				let ns = speed[i] + (Math.floor(Math.random() * 41) - 20)
				ns = Math.max(bs - 70, Math.min(bs + 70, ns))
				speed[i] = ns

				const pe = pingRefs.current[i]
				if (pe) pe.textContent = `${np} ms`
				const se = speedRefs.current[i]
				if (se) se.textContent = `${ns} MB/s`
				const de = dotRefs.current[i]
				if (de) {
					const c = pingColor(np)
					de.style.background = c
					de.style.boxShadow = `0 0 6px ${c}`
				}
			}
		}
		const id = setInterval(tick, 1300)
		return () => clearInterval(id)
	}, [])

	useEffect(() => {
		setLight(isLight())
		const obs = new MutationObserver(() => setLight(isLight()))
		obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
		return () => obs.disconnect()
	}, [])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		let phi = 0
		let w = canvas.offsetWidth || size
		let pointerX: number | null = null
		let spin = 0

		const onResize = () => {
			w = canvas.offsetWidth || size
		}
		window.addEventListener("resize", onResize)

		const globe = createGlobe(canvas, {
			devicePixelRatio: 2,
			width: w * 2,
			height: w * 2,
			phi: 0,
			theta: THETA,
			dark: light ? 0 : 1,
			diffuse: light ? 1.1 : 1.4,
			mapSamples: 22000,
			mapBrightness: light ? 1.5 : 6,
			baseColor: light ? [1, 1, 1] : [0.27, 0.31, 0.42],
			markerColor: [0, 0, 0],
			glowColor: light ? [0.96, 0.97, 0.99] : [0.09, 0.18, 0.42],
			markers: [],
			onRender: (state: Record<string, number>) => {
				const rot = phi + spin
				state.phi = rot
				phi += 0.0032
				state.width = w * 2
				state.height = w * 2

				// Exact camera (from cobe's shader): for a unit direction d, the
				// rotated coord is f = L(theta,phi)·d; cobe's projection is
				// orthographic, so a point at radius R maps to center + R·f.xy·r
				// (y flipped) with depth R·f.z; front hemisphere ⇔ f.z > 0.
				const cp = Math.cos(rot)
				const sp = Math.sin(rot)
				const ct = Math.cos(THETA)
				const st = Math.sin(THETA)
				const r = (w / 2) * 0.8
				const cx = w / 2

				const project = (dx: number, dy: number, dz: number, R: number) => {
					const fx = cp * dx + sp * dz
					const fy = sp * st * dx + ct * dy - cp * st * dz
					const fz = -sp * ct * dx + st * dy + cp * ct * dz
					return { x: cx + R * fx * r, y: cx - R * fy * r, z: fz }
				}

				const svg = svgRef.current
				if (svg) svg.setAttribute("viewBox", `0 0 ${w} ${w}`)

				// ---- network backbone arcs + travelling packets ----------------
				for (let i = 0; i < CONNECTIONS.length; i++) {
					const { a, b, omega, sinO } = CONNECTIONS[i]
					const A = NODE_DIRS[a]
					const B = NODE_DIRS[b]
					const line = lineRefs.current[i]
					const packet = packetRefs.current[i]

					const za = project(A[0], A[1], A[2], 1).z
					const zb = project(B[0], B[1], B[2], 1).z
					const vis = za > 0.02 && zb > 0.02
					const arcOp = vis ? Math.min(za, zb, 0.4) / 0.4 : 0

					if (line) {
						if (arcOp <= 0) {
							line.style.opacity = "0"
						} else {
							let d = ""
							for (let s = 0; s <= ARC_SEG; s++) {
								const t = s / ARC_SEG
								let dx, dy, dz
								if (sinO < 1e-3) {
									dx = A[0] + (B[0] - A[0]) * t
									dy = A[1] + (B[1] - A[1]) * t
									dz = A[2] + (B[2] - A[2]) * t
								} else {
									const w1 = Math.sin((1 - t) * omega) / sinO
									const w2 = Math.sin(t * omega) / sinO
									dx = w1 * A[0] + w2 * B[0]
									dy = w1 * A[1] + w2 * B[1]
									dz = w1 * A[2] + w2 * B[2]
								}
								const R = 1 + ARC_H * Math.sin(Math.PI * t)
								const p = project(dx, dy, dz, R)
								d += (s === 0 ? "M " : " L ") + p.x.toFixed(1) + " " + p.y.toFixed(1)
							}
							line.setAttribute("d", d)
							line.style.opacity = (arcOp * 0.85).toFixed(2)
						}
					}

					let ph = phaseRef.current[i] + 0.0052
					if (ph > 1) ph -= 1
					phaseRef.current[i] = ph
					if (packet) {
						if (arcOp <= 0) {
							packet.style.opacity = "0"
						} else {
							const t = ph
							let dx, dy, dz
							if (sinO < 1e-3) {
								dx = A[0] + (B[0] - A[0]) * t
								dy = A[1] + (B[1] - A[1]) * t
								dz = A[2] + (B[2] - A[2]) * t
							} else {
								const w1 = Math.sin((1 - t) * omega) / sinO
								const w2 = Math.sin(t * omega) / sinO
								dx = w1 * A[0] + w2 * B[0]
								dy = w1 * A[1] + w2 * B[1]
								dz = w1 * A[2] + w2 * B[2]
							}
							const R = 1 + ARC_H * Math.sin(Math.PI * t)
							const p = project(dx, dy, dz, R)
							packet.setAttribute("cx", p.x.toFixed(1))
							packet.setAttribute("cy", p.y.toFixed(1))
							const edge = Math.min(1, Math.sin(Math.PI * t) * 2.2)
							packet.style.opacity = (arcOp * edge).toFixed(2)
						}
					}
				}

				// ---- node markers, live cards, leader lines --------------------
				for (let i = 0; i < LOCATIONS.length; i++) {
					const marker = markerRefs.current[i]
					const card = cardRefs.current[i]
					const arc = arcRefs.current[i]
					const D = NODE_DIRS[i]
					const fx = cp * D[0] + sp * D[2]
					const fy = sp * st * D[0] + ct * D[1] - cp * st * D[2]
					const fz = -sp * ct * D[0] + st * D[1] + cp * ct * D[2]
					const sx = cx + fx * r
					const sy = cx - fy * r

					const op = fz > 0.12 ? 1 : fz > 0 ? fz / 0.12 : 0
					const o = op.toFixed(2)

					const stagger = (i % 3) - 1 // -1, 0, 1
					const cardX = sx + stagger * 16
					const cardY = sy - CARD_UP

					if (marker) {
						marker.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`
						marker.style.opacity = o
					}
					if (card) {
						card.style.transform = `translate(${cardX.toFixed(1)}px, ${cardY.toFixed(1)}px) translate(-50%, -50%)`
						card.style.opacity = o
					}
					if (arc) {
						const x0 = sx
						const y0 = sy - 5
						const x1 = cardX
						const y1 = cardY + 18
						const cxp = (x0 + x1) / 2 + stagger * 9
						const cyp = (y0 + y1) / 2
						arc.setAttribute("d", `M ${x0.toFixed(1)} ${y0.toFixed(1)} Q ${cxp.toFixed(1)} ${cyp.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`)
						arc.style.opacity = (op * 0.5).toFixed(2)
					}
				}
			}
		} as unknown as Parameters<typeof createGlobe>[1])

		const onDown = (e: PointerEvent) => {
			pointerX = e.clientX
			canvas.style.cursor = "grabbing"
		}
		const onUp = () => {
			pointerX = null
			canvas.style.cursor = "grab"
		}
		const onMove = (e: PointerEvent) => {
			if (pointerX === null) return
			spin += (e.clientX - pointerX) / 200
			pointerX = e.clientX
		}
		canvas.addEventListener("pointerdown", onDown)
		window.addEventListener("pointerup", onUp)
		window.addEventListener("pointermove", onMove)

		const t = setTimeout(() => {
			canvas.style.opacity = "1"
		}, 80)

		return () => {
			clearTimeout(t)
			globe.destroy()
			window.removeEventListener("resize", onResize)
			canvas.removeEventListener("pointerdown", onDown)
			window.removeEventListener("pointerup", onUp)
			window.removeEventListener("pointermove", onMove)
		}
	}, [light, size])

	const node = "#6aa5ff"
	const nodeLight = "#2f6bff"
	const arcStroke = light ? "#2f6bff" : "#6aa5ff"
	const packetFill = light ? "#2f6bff" : "#8fc0ff"

	return (
		<div className={`relative mx-auto font-[ui-monospace,SFMono-Regular,Menlo,monospace] ${className}`} style={{ width: size, maxWidth: "100%" }}>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-[6%] -z-[1] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(120,160,255,0.18),transparent_70%)] blur-[46px] light:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(47,107,255,0.08),transparent_72%)]"
			/>
			<canvas
				ref={canvasRef}
				style={{ width: "100%", height: "auto", aspectRatio: "1", opacity: 0, transition: "opacity 1.1s ease", cursor: "grab" }}
				aria-label="Глобус с расположением прокси-серверов"
			/>

			{/* leader lines + backbone arcs, drawn in CSS-pixel space each frame */}
			<svg ref={svgRef} className="pointer-events-none absolute inset-0 z-[1] h-full w-full" fill="none" preserveAspectRatio="none">
				{CONNECTIONS.map((c, i) => (
					<path
						key={`arc-${i}`}
						ref={el => {
							lineRefs.current[i] = el
						}}
						stroke={arcStroke}
						strokeWidth={1}
						strokeLinecap="round"
						style={{ opacity: 0 }}
					/>
				))}
				{CONNECTIONS.map((c, i) => (
					<circle
						key={`pkt-${i}`}
						ref={el => {
							packetRefs.current[i] = el
						}}
						r={2.4}
						fill={packetFill}
						style={{ opacity: 0, filter: `drop-shadow(0 0 5px ${packetFill})` }}
					/>
				))}
				{LOCATIONS.map((l, i) => (
					<path
						key={l.city}
						ref={el => {
							arcRefs.current[i] = el
						}}
						stroke={light ? "#9aa6bd" : "#5d6b86"}
						strokeWidth={1}
						style={{ opacity: 0 }}
					/>
				))}
			</svg>

			{/* pulsing radar markers */}
			{LOCATIONS.map((l, i) => (
				<div
					key={`m-${l.city}`}
					ref={el => {
						markerRefs.current[i] = el
					}}
					style={{ opacity: 0, left: 0, top: 0, willChange: "transform, opacity" }}
					className="pointer-events-none absolute z-[2]"
				>
					<span className="relative block h-3.5 w-3.5">
						<span className="absolute inset-0 rounded-full bg-[#6aa5ff]/45 light:bg-[#2f6bff]/35 motion-safe:animate-ping" />
						<span
							className="absolute inset-[3.5px] rounded-full ring-[2.5px] ring-white/85 light:ring-white"
							style={{ background: light ? nodeLight : node, boxShadow: `0 0 12px 2px ${light ? "rgba(47,107,255,0.5)" : "rgba(106,165,255,0.7)"}` }}
						/>
					</span>
				</div>
			))}

			{/* live cards: city · ping · speed */}
			{LOCATIONS.map((l, i) => (
				<div
					key={`c-${l.city}`}
					ref={el => {
						cardRefs.current[i] = el
					}}
					style={{ opacity: 0, left: 0, top: 0, willChange: "transform, opacity" }}
					className="pointer-events-none absolute z-[4] whitespace-nowrap rounded-[9px] border border-white/10 bg-[#0b1426]/90 px-2.5 py-1.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md light:border-black/[0.07] light:bg-white/95 light:shadow-[0_12px_30px_-14px_rgba(15,23,42,0.35)]"
				>
					<div className="flex items-center gap-1.5 text-[11px] font-medium leading-none text-white light:text-[#0e1019]">
						<span
							ref={el => {
								dotRefs.current[i] = el
							}}
							className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
							style={{ background: pingColor(l.ping), boxShadow: `0 0 6px ${pingColor(l.ping)}` }}
						/>
						{l.city}
					</div>
					<div className="mt-1.5 flex items-center gap-2 text-[10px] leading-none text-white/55 light:text-[#5b6472]">
						<span className="inline-flex items-center gap-1">
							<Activity className="h-2.5 w-2.5 text-[#6aa5ff] light:text-[#2f6bff]" />
							<span ref={el => { pingRefs.current[i] = el }} className="tabular-nums">{l.ping} ms</span>
						</span>
						<span className="text-white/20 light:text-black/15">·</span>
						<span className="inline-flex items-center gap-1">
							<Zap className="h-2.5 w-2.5 text-[#6aa5ff] light:text-[#2f6bff]" />
							<span ref={el => { speedRefs.current[i] = el }} className="tabular-nums">{l.speed} MB/s</span>
						</span>
					</div>
				</div>
			))}

			{/* network caption */}
			<div className="pointer-events-none mt-3 flex items-center justify-center gap-2 text-[12px] tracking-[0.22em] text-[#6aa5ff] light:text-[#2f6bff]">
				<svg width="11" height="10" viewBox="0 0 11 10" aria-hidden><path d="M5.5 0L11 10H0z" fill="currentColor" /></svg>
				PROXY NETWORK
			</div>
		</div>
	)
}
