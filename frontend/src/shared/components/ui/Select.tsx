"use client"

import { Check, ChevronDown } from "lucide-react"
import { type FC, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"

type SelectProps = {
	value: string
	onChange: (value: string) => void
	className?: string
	children: ReactNode
	size?: "default" | "small"
	placeholder?: ReactNode
	buttonClassName?: string
	menuClassName?: string
	ariaLabel?: string
}

type OptionProps = {
	value: string
	children: ReactNode
}

const SelectOption: FC<OptionProps> = () => null

const Select: FC<SelectProps> & { Option: FC<OptionProps> } = ({
	value,
	onChange,
	className,
	children,
	size = "default",
	placeholder = "Не выбрано",
	buttonClassName = "",
	menuClassName = "",
	ariaLabel
}) => {
	const [open, setOpen] = useState(false)
	const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
	const rootRef = useRef<HTMLDivElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const listboxId = useId()

	const options = (Array.isArray(children) ? children : [children]).filter(
		Boolean
	) as React.ReactElement<OptionProps>[]

	const selected = options.find(opt => opt.props.value === value)

	const positionMenu = useCallback(() => {
		const rect = buttonRef.current?.getBoundingClientRect()
		if (!rect) return
		const width = Math.max(rect.width, 180)
		const roomBelow = window.innerHeight - rect.bottom
		const estimatedHeight = Math.min(options.length * 48 + 8, 320)
		const openAbove = roomBelow < estimatedHeight && rect.top > roomBelow
		setMenuStyle({
			position: "fixed",
			left: Math.min(rect.left, window.innerWidth - width - 12),
			top: openAbove ? Math.max(12, rect.top - estimatedHeight - 8) : rect.bottom + 8,
			width,
			maxHeight: Math.min(320, openAbove ? rect.top - 20 : roomBelow - 20)
		})
	}, [options.length])

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node
			if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
				setOpen(false)
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () =>
			document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	useEffect(() => {
		if (!open) return
		positionMenu()
		const close = () => setOpen(false)
		window.addEventListener("resize", close)
		window.addEventListener("scroll", close, true)
		return () => {
			window.removeEventListener("resize", close)
			window.removeEventListener("scroll", close, true)
		}
	}, [open, positionMenu])

	return (
		<div
			ref={rootRef}
			className={`relative inline-block w-full md:w-fit ${className || ""}`}
		>
			<button
				ref={buttonRef}
				onClick={() => {
					positionMenu()
					setOpen(prev => !prev)
				}}
				onKeyDown={event => {
					if (event.key === "Escape") setOpen(false)
					if (event.key === "ArrowDown") {
						event.preventDefault()
						positionMenu()
						setOpen(true)
					}
				}}
				type="button"
				aria-label={ariaLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listboxId}
				className={`${size === "default" ? "text-lg md:text-xl" : "text-sm"} bg-card/50 text-body border-body/25 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-2 px-4 py-2 font-medium whitespace-nowrap duration-200 hover:brightness-90 focus-visible:ring-2 focus-visible:ring-[#4f8dff] focus-visible:outline-none ${buttonClassName}`}
			>
				{value.length ? selected?.props.children : placeholder}
				<ChevronDown
					className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && typeof document !== "undefined" && createPortal(
				<div
					id={listboxId}
					ref={menuRef}
					role="listbox"
					style={menuStyle}
					className={`border-body/25 bg-card/95 z-[100] overflow-y-auto rounded-xl border-2 p-1 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl ${menuClassName}`}
				>
					{options.map(opt => (
						<button
							type="button"
							role="option"
							aria-selected={value === opt.props.value}
							key={opt.props.value}
							onClick={() => {
								onChange(opt.props.value)
								setOpen(false)
							}}
							className={`${size === "default" ? "text-base md:text-lg" : "text-sm"} text-body flex w-full cursor-pointer flex-row items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left font-medium duration-200 hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none ${
								value === opt.props.value ? "bg-body/2" : ""
							}`}
						>
							<span className="flex min-w-0 items-center gap-2">{opt.props.children}</span>
							{value === opt.props.value ? <Check className="h-4 w-4 shrink-0 text-[#6aa5ff]" /> : null}
						</button>
					))}
				</div>,
				document.body
			)}
		</div>
	)
}

Select.Option = SelectOption

export default Select
