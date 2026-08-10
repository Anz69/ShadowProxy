import type { FC, ReactNode } from "react"

type Props = {
	children: ReactNode
	className?: string
}

/**
 * Section eyebrow — small uppercase caption with a sparkle, sits above a
 * section title (e.g. "✦ ПРЕИМУЩЕСТВА"). Presentational, brand blue accent.
 */
const SectionEyebrow: FC<Props> = ({ children, className }) => (
	<span className={`section-eyebrow${className ? ` ${className}` : ""}`}>
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
		</svg>
		{children}
	</span>
)

export default SectionEyebrow
