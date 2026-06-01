import type { FC, ReactNode } from "react"

type ButtonProps = {
	children: ReactNode
	variant: "fill" | "outline" | "white" | "error-outline" | "error"
	type: "submit" | "button"
	disabled?: boolean
	onClick?: () => void
	className?: string
}

const Button: FC<ButtonProps> = ({
	children,
	variant,
	type,
	disabled = false,
	onClick,
	className = ""
}) => {
	return (
		<button
			className={`
${className}
${variant === "fill" && "bg-primary text-body border-2 border-transparent"}
${variant === "outline" && "bg-back/50 text-body border-primary border-2"}
${variant === "white" && "bg-body text-back"}
${variant === "error-outline" && "bg-error/25 border-2 border-error text-error"}
${variant === "error" && "bg-error text-body"}
flex w-full flex-row items-center justify-center gap-1 rounded-xl 
${variant === "white" ? "px-6" : "px-4"} py-1.5 text-base font-semibold leading-4 h-10
hover:brightness-90 active:brightness-75 duration-200 ease-in-out cursor-pointer 
disabled:opacity-60 disabled:brightness-100 disabled:cursor-not-allowed`}
			disabled={disabled}
			onClick={onClick}
			type={type}
		>
			{children}
		</button>
	)
}

export default Button
