import { Check, ChevronDown } from "lucide-react"
import { type FC, useEffect, useRef, useState } from "react"

type Option = { value: string; label: string }

type MultiSelectProps = {
	options: Option[]
	value: string[]
	onChange: (value: string[]) => void
	placeholder?: string
	className?: string
	size?: "default" | "small"
}

const MultiSelect: FC<MultiSelectProps> = ({
	options,
	value,
	onChange,
	placeholder = "Не выбрано",
	className,
	size = "default"
}) => {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () =>
			document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	const toggle = (v: string) => {
		onChange(
			value.includes(v)
				? value.filter((x) => x !== v)
				: [...value, v]
		)
	}

	const label =
		value.length === 0
			? placeholder
			: options
					.filter((o) => value.includes(o.value))
					.map((o) => o.label)
					.join(", ")

	return (
		<div
			ref={ref}
			className={`relative inline-block w-full md:w-fit ${className || ""}`}
		>
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className={`${size === "default" ? "text-lg md:text-xl" : "text-base"} bg-card/50 text-body border-body/25 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-2 px-4 py-2 font-medium whitespace-nowrap duration-200 hover:brightness-90`}
			>
				<span className="max-w-[220px] truncate text-left">{label}</span>
				<ChevronDown
					className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && (
				<div className="border-body/25 bg-card/95 absolute left-0 z-50 mt-2 w-full min-w-[200px] rounded-xl border-2 backdrop-blur-sm">
					{options.map((opt) => {
						const active = value.includes(opt.value)
						return (
							<div
								key={opt.value}
								onClick={() => toggle(opt.value)}
								className={`${size === "default" ? "text-base md:text-lg" : "text-sm md:text-base"} text-body flex cursor-pointer flex-row items-center gap-2 px-4 py-3 font-medium duration-200 hover:brightness-90 ${active ? "bg-body/2" : ""}`}
							>
								<span
									className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${active ? "border-[#0067FF] bg-[#0067FF]" : "border-body/30"}`}
								>
									{active && <Check className="h-3.5 w-3.5 text-white" />}
								</span>
								{opt.label}
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}

export default MultiSelect
