"use client"

import type { CSSProperties, ElementType, ReactNode } from "react"

import Reveal, { type RevealVariant } from "./Reveal"

type RevealGroupProps = {
	children: ReactNode
	as?: ElementType
	variant?: RevealVariant
	delay?: number
	duration?: number
	/** seconds between each child; defaults to brand 0.08 */
	stagger?: number
	amount?: number
	className?: string
	style?: CSSProperties
}

/** Convenience wrapper: reveals direct children with a stagger (grids, rows). */
export default function RevealGroup({
	stagger = 0.08,
	...props
}: RevealGroupProps) {
	return <Reveal stagger={stagger} {...props} />
}
