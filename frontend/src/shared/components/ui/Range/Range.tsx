import styles from "./Range.module.css"
import type { FC } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

type RangeProps = {
	min: number
	max: number
	step: number
	marks: string[]
	value: number
	onChange: (v: number) => void
}

const Range: FC<RangeProps> = ({ min, max, step, marks, value, onChange }) => {
	const percent = ((value - min) / (max - min)) * 100
	const wrapRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const bubbleRef = useRef<HTMLDivElement>(null)
	const [left, setLeft] = useState(0)

	const updateBubble = () => {
		const input = inputRef.current
		const bubble = bubbleRef.current
		if (!input || !bubble) return
		const trackWidth = input.offsetWidth
		const cssThumb = getComputedStyle(input).getPropertyValue("--thumb")
		const thumb = parseFloat(cssThumb) || 20
		const bw = bubble.offsetWidth
		const p = (value - min) / (max - min)
		const center = p * (trackWidth - thumb) + thumb / 2
		const leftEdge = center - bw / 2
		const clampedLeft = Math.max(0, Math.min(leftEdge, trackWidth - bw))
		setLeft(clampedLeft)
	}

	useLayoutEffect(() => {
		updateBubble()
	}, [value, min, max])

	useEffect(() => {
		const onResize = () => updateBubble()
		window.addEventListener("resize", onResize)
		return () => window.removeEventListener("resize", onResize)
	}, [])

	return (
		<div className="w-full">
			<div ref={wrapRef} className={styles.sliderWrap}>
				<input
					ref={inputRef}
					type="range"
					className={styles.range}
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={e => onChange(Number(e.target.value))}
					style={{ ["--val" as string]: `${percent}%` }}
				/>
				<div
					ref={bubbleRef}
					className={styles.valueBubble}
					style={{ left }}
				>
					{value} мин
				</div>
			</div>
			<div className="flex w-full flex-row items-center justify-between">
				{marks.map(el => (
					<span
						className="text-body/50 light:text-[#8a93a3] relative text-lg font-semibold"
						key={el}
					>
						{el}
					</span>
				))}
			</div>
		</div>
	)
}

export default Range
