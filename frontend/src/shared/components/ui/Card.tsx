import type { FC, ReactNode } from "react"

type CardProps = {
	children: ReactNode
	className?: string
}

const Card: FC<CardProps> = ({ children, className = "" }) => {
	return (
		<div
			className={`glass-card flex flex-col items-center gap-4 px-4 md:px-8 py-5 ${className}`}
		>
			{children}
		</div>
	)
}

export default Card
