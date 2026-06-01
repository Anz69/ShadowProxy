import type { FC, ReactNode } from "react"

type FootnoteProps = {
	children: ReactNode
	variant: "success" | "error"
	className?: string
}

const Footnote: FC<FootnoteProps> = ({ children, variant, className }) => {
	return (
		<div
			className={`${className} ${variant === "error" ? "border-error bg-error/25 text-error" : "border-success bg-success/25 text-success"} font-medium w-full rounded-xl border-2 p-2 text-left text-base`}
		>
			{children}
		</div>
	)
}

export default Footnote
