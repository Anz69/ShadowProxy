"use client"
import { type FC, useEffect, useRef, useState } from "react"

type SegmentedControlProps = {
	options: string[]
	value?: string
	onChange?: (val: string) => void
	activeBgColor?: string // Цвет фона активного элемента
}

const SegmentedControl: FC<SegmentedControlProps> = ({
	options,
	value,
	onChange,
	activeBgColor = "bg-primary"
}) => {
	const [active, setActive] = useState(value ?? options[0])
	const [left, setLeft] = useState(0)
	const [width, setWidth] = useState(0)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (value && value !== active) {
			setActive(value)
		}
	}, [value])

	useEffect(() => {
		const idx = options.indexOf(active)
		const container = containerRef.current
		if (container && idx >= 0) {
			const el = container.children[idx + 1] as HTMLElement
			setLeft(el.offsetLeft)
			setWidth(el.offsetWidth)
		}
	}, [active, options])

	const handleClick = (opt: string) => {
		setActive(opt)
		onChange?.(opt)
	}

	return (
		<div
			ref={containerRef}
			className="relative flex rounded-xl border-2 border-body/25 bg-card/50 p-1.5 w-full"
		>
			<span
				className={`absolute top-1.5 bottom-1.5 rounded-lg ${activeBgColor} transition-all duration-300`}
				style={{ left, width }}
			/>
			{options.map(opt => (
				<button
					key={opt}
					onClick={() => handleClick(opt)}
					type="button"
					className={`relative z-10 flex-1 rounded-lg px-4 py-2 text-sm md:text-lg font-medium md:font-semibold leading-5 transition-colors cursor-pointer text-body`}
				>
					{opt}
				</button>
			))}
		</div>
	)
}

export default SegmentedControl
