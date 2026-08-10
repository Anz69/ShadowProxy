"use client"

import { Check, Copy as CopyIcon } from "lucide-react"
import { type FC, useState } from "react"

type CopyProps = {
	value: string
}

const Copy: FC<CopyProps> = ({ value }) => {
	const [isCopying, setIsCopying] = useState(false)

	const handleClick = () => {
		window.navigator.clipboard.writeText(value)
		setIsCopying(true)
		setTimeout(() => {
			setIsCopying(false)
		}, 1500)
	}

	if (isCopying) return <Check className="text-body h-4 w-4" />
	return (
		<CopyIcon
			className="text-body/80 hover:text-body h-4 w-4 shrink-0 cursor-pointer duration-200"
			onClick={handleClick}
		/>
	)
}

export default Copy
