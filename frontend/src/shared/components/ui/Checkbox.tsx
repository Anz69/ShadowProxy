import { type FC } from "react"

type CheckboxProps = {
	checked: boolean
	onChange: (checked: boolean) => void
	label?: string
	className?: string
	disabled?: boolean
}

const Checkbox: FC<CheckboxProps> = ({
	checked,
	onChange,
	label,
	className,
	disabled
}) => {
	return (
		<label
			className={`flex cursor-pointer items-center gap-3 select-none ${className || ""}`}
		>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={e => onChange(e.target.checked)}
				className="peer hidden"
			/>
			<div
				className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors duration-100 ${checked ? "border-primary bg-primary" : "border-body/25 bg-card/50"} peer-hover:brightness-90 ${disabled && "opacity-30 cursor-not-allowed"}`}
			>
				{checked && (
					<svg
						className="text-body h-4 w-4"
						fill="none"
						stroke="currentColor"
						strokeWidth={3}
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				)}
			</div>
			{label && (
				<span className="text-body text-lg font-medium">{label}</span>
			)}
		</label>
	)
}

export default Checkbox
