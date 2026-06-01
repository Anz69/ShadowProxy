import { ChevronDown } from "lucide-react"
import {
	type FC, isValidElement, type ReactElement,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState
} from "react"

import Input from "@/shared/components/ui/Input"

type SelectWithSearchProps = {
	value: string
	onChange: (value: string) => void
	className?: string
	children: ReactNode
	size?: "default" | "small"
	searchInputProps?: React.InputHTMLAttributes<HTMLInputElement>
}

type OptionProps = {
	value: string
	children: ReactNode
	label: string
}

const SelectSearchOption: FC<OptionProps> = ({ value }) => null

const getText = (node: ReactNode): string => {
	if (node == null) return ""
	if (typeof node === "string" || typeof node === "number") return String(node)
	if (Array.isArray(node)) return node.map(getText).join("")
	if (isValidElement(node)) {
		const element = node as ReactElement<{ children?: ReactNode }>
		return getText(element.props.children)
	}
	return ""
}

const SelectWithSearch: FC<SelectWithSearchProps> & {
	Option: FC<OptionProps>
} = ({
	value,
	onChange,
	className,
	children,
	size = "default",
	searchInputProps
}) => {
	const [open, setOpen] = useState(false)
	const [q, setQ] = useState("")
	const ref = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	const options = useMemo(() => {
		const arr = (Array.isArray(children) ? children : [children]).filter(
			Boolean
		) as React.ReactElement<OptionProps>[]
		return arr.map(opt => {
			const label = getText(opt.props.children).trim()
			return { value: opt.props.value, label, element: opt }
		})
	}, [children])

	const selected = options.find(o => o.value === value)

	const filtered = useMemo(() => {
		const query = q.toLowerCase()
		if (!query) return options
		return options.filter(o => o.label.toLowerCase().includes(query))
	}, [options, q])

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

	useEffect(() => {
		if (open) {
			setTimeout(() => inputRef.current?.focus(), 0)
		} else {
			setQ("")
		}
	}, [open])

	return (
		<div
			ref={ref}
			className={`relative inline-block w-fit ${className || ""}`}
		>
			<button
				onClick={() => setOpen(prev => !prev)}
				type="button"
				className={`${size === "default" ? "text-lg md:text-xl" : "text-base"} bg-card/50 text-body border-body/25 flex w-full whitespace-nowrap cursor-pointer items-center justify-between gap-2 rounded-xl border-2 px-4 py-2 font-medium duration-200 hover:brightness-90`}
			>
				{value.length ? selected?.label || "" : "Не выбрано"}
				<ChevronDown
					className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && (
				<div className="border-body/25 bg-card/80 absolute left-0 z-10 mt-2 w-full rounded-xl border-2 backdrop-blur-sm">
					<div className="px-3 py-2">
						<Input
							ref={inputRef}
							value={q}
							onChange={e => setQ(e.target.value)}
							className={`${size === "default" ? "text-base md:text-lg" : "text-base"} border-body/25 hover:border-[#0067FF] focus:border-[#0067FF] bg-card/60 w-full rounded-lg border-2 px-3 py-2 outline-none`}
							{...searchInputProps}
						/>
					</div>
					<div className="max-h-64 overflow-y-auto overflow-x-hidden">
						{filtered.map(o => (
							<div
								key={o.value}
								onClick={() => {
									onChange(o.value)
									setOpen(false)
								}}
								className={`${size === "default" ? "text-lg" : "text-base"} text-body flex cursor-pointer flex-row items-center gap-1 px-4 py-3 whitespace-nowrap font-medium duration-200 hover:brightness-90 ${value === o.value ? "bg-body/2" : ""}`}
								title={o.element.props.label}
							>
								{o.element.props.children}
							</div>
						))}

						{!filtered.length && (
							<div
								className={`${size === "default" ? "text-lg" : "text-base"} text-body/70 px-4 py-3 select-none`}
							>
								Ничего не найдено
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

SelectWithSearch.Option = SelectSearchOption

export default SelectWithSearch
