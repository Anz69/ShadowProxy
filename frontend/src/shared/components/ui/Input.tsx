"use client"

import { Eye, EyeOff } from "lucide-react"
import {
	type InputHTMLAttributes,
	type ReactNode,
	forwardRef,
	useState
} from "react"

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
	error?: string
	topLabel?: ReactNode
	rightLabel?: string
}

const eyeClassname =
	"text-body/25 hover:text-body/50 cursor-pointer absolute top-3 right-4 h-5 w-5 duration-200"

const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, error, type, topLabel, rightLabel, ...props }, ref) => {
		const [newType, setNewType] = useState(type)

		return (
			<div className="relative flex w-full flex-col">
				{topLabel}
				<input
					ref={ref}
					type={newType}
					className={` ${className} ${error?.length && "!text-error !border-error"} ${type === "password" && "!pr-12"} ${props.disabled && "hover:!border-body/25 opacity-50"} bg-card/50 text-body border-body/25 hover:border-[#0067FF] focus:border-[#0067FF] w-full rounded-xl border-2 px-4 py-2 text-base font-medium duration-200 outline-none`}
					suppressHydrationWarning
					{...props}
				/>
				{error && (
					<span className="text-error w-full text-left text-base">
						{error}
					</span>
				)}
				{rightLabel && (
					<span className="text-body/50 absolute top-[7px] right-4 h-5 w-5 text-xl font-semibold duration-200 select-none">
						{rightLabel}
					</span>
				)}
				{type === "password" && newType === "password" && (
					<Eye
						className={eyeClassname}
						onClick={() => setNewType("text")}
					/>
				)}
				{type === "password" && newType === "text" && (
					<EyeOff
						className={eyeClassname}
						onClick={() => setNewType("password")}
					/>
				)}
			</div>
		)
	}
)

Input.displayName = "Input"

export default Input
