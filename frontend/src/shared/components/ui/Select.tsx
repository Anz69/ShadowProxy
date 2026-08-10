import { ChevronDown } from "lucide-react"
import { type FC, type ReactNode, useEffect, useRef, useState } from "react"

type SelectProps = {
	value: string
	onChange: (value: string) => void
	className?: string
	children: ReactNode
	size?: "default" | "small"
}

type OptionProps = {
	value: string
	children: ReactNode
}

const SelectOption: FC<OptionProps> = ({ value }) => null

const Select: FC<SelectProps> & { Option: FC<OptionProps> } = ({
	value,
	onChange,
	className,
	children,
	size = "default"
}) => {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)

	const options = (Array.isArray(children) ? children : [children]).filter(
		Boolean
	) as React.ReactElement<OptionProps>[]

	const selected = options.find(opt => opt.props.value === value)

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

	return (
		<div
			ref={ref}
			className={`relative inline-block w-full md:w-fit ${className || ""}`}
		>
			<button
				onClick={() => setOpen(prev => !prev)}
				type="button"
				className={`${size === "default" ? "text-lg md:text-xl" : "text-base"} bg-card/50 text-body border-body/25 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-2 px-4 py-2 font-medium whitespace-nowrap duration-200 hover:brightness-90`}
			>
				{value.length ? selected?.props.children : "Не выбрано"}
				<ChevronDown
					className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && (
				<div className="border-body/25 bg-card/95 absolute left-0 z-50 mt-2 w-full rounded-xl border-2 backdrop-blur-sm">
					{options.map(opt => (
						<div
							key={opt.props.value}
							onClick={() => {
								onChange(opt.props.value)
								setOpen(false)
							}}
							className={`${size === "default" ? "text-base md:text-lg" : "text-sm md:text-base"} text-body flex cursor-pointer flex-row items-center gap-1 px-4 py-3 font-medium duration-200 hover:brightness-90 ${
								value === opt.props.value ? "bg-body/2" : ""
							}`}
						>
							{opt.props.children}
						</div>
					))}
				</div>
			)}
		</div>
	)
}

Select.Option = SelectOption

export default Select
